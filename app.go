package main

import (
	"context"
	"encoding/json"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/creack/pty"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

type Profile struct {
	Name       string `json:"name"`
	Username   string `json:"username"`
	Password   string `json:"password"`
	ConfigFile string `json:"config_file"`
}

type App struct {
	ctx        context.Context
	mu         sync.Mutex
	ptmx       io.WriteCloser
	cancel     context.CancelFunc
	status     string
	configFile string
}

func NewApp() *App {
	return &App{status: "disconnected"}
}

func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

func profilesPath() string {
	return filepath.Join(homeDir(), ".vpn", "profiles.json")
}

func (a *App) GetProfiles() []Profile {
	data, err := os.ReadFile(profilesPath())
	if err != nil {
		return []Profile{}
	}
	var profiles []Profile
	json.Unmarshal(data, &profiles)
	return profiles
}

func (a *App) SaveProfile(name, username, password, configFile string) string {
	profiles := a.GetProfiles()
	found := false
	for i, p := range profiles {
		if p.Name == name {
			profiles[i] = Profile{Name: name, Username: username, Password: password, ConfigFile: configFile}
			found = true
			break
		}
	}
	if !found {
		profiles = append(profiles, Profile{Name: name, Username: username, Password: password, ConfigFile: configFile})
	}
	data, _ := json.Marshal(profiles)
	os.MkdirAll(filepath.Dir(profilesPath()), 0700)
	if err := os.WriteFile(profilesPath(), data, 0600); err != nil {
		return "error: " + err.Error()
	}
	return "saved"
}

func (a *App) DeleteProfile(name string) string {
	profiles := a.GetProfiles()
	for i, p := range profiles {
		if p.Name == name {
			profiles = append(profiles[:i], profiles[i+1:]...)
			break
		}
	}
	data, _ := json.Marshal(profiles)
	os.WriteFile(profilesPath(), data, 0600)
	return "deleted"
}

func (a *App) BrowseConfig() string {
	file, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title: "Select OpenVPN Config",
		Filters: []runtime.FileFilter{
			{DisplayName: "OpenVPN Files", Pattern: "*.ovpn;*.conf"},
			{DisplayName: "All Files", Pattern: "*"},
		},
	})
	if err != nil {
		return ""
	}
	return file
}

func (a *App) GetStatus() string {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.status
}

func (a *App) setStatus(s string) {
	a.mu.Lock()
	a.status = s
	a.mu.Unlock()
	runtime.EventsEmit(a.ctx, "vpn-status", s)
}

func (a *App) Connect(username, password, configFile string) string {
	a.mu.Lock()
	if a.status == "connected" || a.status == "connecting" {
		a.mu.Unlock()
		return "already " + a.status
	}
	a.mu.Unlock()

	if configFile == "" {
		return "no config file"
	}
	a.mu.Lock()
	a.configFile = configFile
	a.mu.Unlock()

	a.setStatus("connecting")

	ctx, cancel := context.WithCancel(context.Background())
	a.mu.Lock()
	a.cancel = cancel
	a.mu.Unlock()

	cmd := exec.CommandContext(ctx, "openvpn3", "session-start", "--config", configFile)
	ptmx, err := pty.Start(cmd)
	if err != nil {
		a.setStatus("disconnected")
		return "failed to start: " + err.Error()
	}

	a.mu.Lock()
	a.ptmx = ptmx
	a.mu.Unlock()

	go a.handleSession(ptmx, cmd, username, password)
	return "connecting"
}

func (a *App) SendOTP(otp string) {
	a.mu.Lock()
	w := a.ptmx
	a.mu.Unlock()
	if w != nil {
		w.Write([]byte(otp + "\n"))
	}
}

func (a *App) Disconnect() string {
	a.mu.Lock()
	cancel := a.cancel
	cfg := a.configFile
	a.mu.Unlock()

	if cancel != nil {
		cancel()
	}
	exec.Command("openvpn3", "session-manage", "--config", cfg, "--disconnect").Run()
	a.setStatus("disconnected")
	return "disconnected"
}

func (a *App) handleSession(ptmx io.ReadWriteCloser, cmd *exec.Cmd, username, password string) {
	defer ptmx.Close()
	defer func() {
		if a.GetStatus() != "connected" {
			a.setStatus("disconnected")
		}
	}()

	buf := make([]byte, 1024)
	var lineBuf string
	sentUser, sentPass := false, false

	for {
		n, err := ptmx.Read(buf)
		if n > 0 {
			chunk := string(buf[:n])
			lineBuf += chunk
			runtime.EventsEmit(a.ctx, "vpn-log", chunk)
			lower := strings.ToLower(lineBuf)

			if strings.Contains(lower, "username") && !sentUser && username != "" {
				ptmx.Write([]byte(username + "\n"))
				sentUser = true
				lineBuf = ""
			} else if strings.Contains(lower, "password") && !sentPass && password != "" {
				ptmx.Write([]byte(password + "\n"))
				sentPass = true
				lineBuf = ""
			} else if strings.Contains(lower, "authenticator") || strings.Contains(lower, "challenge") || strings.Contains(lower, "otp") || strings.Contains(lower, "2fa") || strings.Contains(lower, "verification code") {
				a.setStatus("waiting_2fa")
				lineBuf = ""
			} else if strings.Contains(lower, "connected") {
				a.setStatus("connected")
				go a.startHealthCheck()
				lineBuf = ""
			} else if strings.Contains(lower, "auth_failed") || strings.Contains(lower, "authentication failed") {
				a.setStatus("auth_failed")
				return
			}

			// Reset buffer on newline to avoid matching old content
			if strings.Contains(chunk, "\n") {
				lineBuf = chunk[strings.LastIndex(chunk, "\n")+1:]
			}
		}
		if err != nil {
			break
		}
	}
	cmd.Wait()
}

func (a *App) startHealthCheck() {
	for {
		time.Sleep(10 * time.Second)
		if a.GetStatus() != "connected" {
			return
		}
		out, _ := exec.Command("openvpn3", "sessions-list").Output()
		if strings.Contains(string(out), "No sessions available") || !strings.Contains(strings.ToLower(string(out)), "session") {
			a.setStatus("disconnected")
			runtime.EventsEmit(a.ctx, "vpn-log", "Session lost. VPN disconnected.\n")
			return
		}
	}
}

func homeDir() string {
	home, _ := os.UserHomeDir()
	return home
}
