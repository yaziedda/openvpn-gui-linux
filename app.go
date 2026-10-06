package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
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

type SessionStats struct {
	Status       string `json:"status"`
	ProfileName  string `json:"profile_name"`
	ConfigFile   string `json:"config_file"`
	VPNIP        string `json:"vpn_ip"`
	ServerIP     string `json:"server_ip"`
	Device       string `json:"device"`
	DurationSecs int64  `json:"duration_secs"`
	BytesIn      int64  `json:"bytes_in"`
	BytesOut     int64  `json:"bytes_out"`
}

type App struct {
	ctx            context.Context
	mu             sync.Mutex
	ptmx           io.WriteCloser
	cancel         context.CancelFunc
	status         string
	configFile     string
	currentProfile string
	connectedAt    time.Time
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
	if s == "connected" && a.connectedAt.IsZero() {
		a.connectedAt = time.Now()
	} else if s != "connected" {
		a.connectedAt = time.Time{}
	}
	a.mu.Unlock()
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "vpn-status", s)
	}
}

func (a *App) Connect(username, password, configFile, profileName string) string {
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
	a.currentProfile = profileName
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

func getVPNIP() (string, string) {
	ifaces, err := net.Interfaces()
	if err != nil {
		return "-", "-"
	}
	for _, iface := range ifaces {
		if strings.HasPrefix(iface.Name, "tun") || strings.HasPrefix(iface.Name, "ovpn") {
			addrs, err := iface.Addrs()
			if err != nil {
				continue
			}
			for _, addr := range addrs {
				if ipnet, ok := addr.(*net.IPNet); ok && !ipnet.IP.IsLoopback() {
					if ipnet.IP.To4() != nil {
						return ipnet.IP.String(), iface.Name
					}
				}
			}
			return "-", iface.Name
		}
	}
	return "-", "-"
}

func getServerIP(configFile string) string {
	if configFile == "" {
		return "-"
	}
	data, err := os.ReadFile(configFile)
	if err != nil {
		return "-"
	}
	lines := strings.Split(string(data), "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "remote ") {
			fields := strings.Fields(line)
			if len(fields) >= 3 {
				return fields[1] + ":" + fields[2]
			} else if len(fields) >= 2 {
				return fields[1]
			}
		}
	}
	return "-"
}

func getDeviceStats(dev string) (int64, int64) {
	if dev == "" || dev == "-" {
		return 0, 0
	}
	data, err := os.ReadFile("/proc/net/dev")
	if err != nil {
		return 0, 0
	}
	for _, line := range strings.Split(string(data), "\n") {
		parts := strings.Split(line, ":")
		if len(parts) == 2 && strings.TrimSpace(parts[0]) == dev {
			fields := strings.Fields(parts[1])
			if len(fields) >= 9 {
				var rx, tx int64
				fmt.Sscanf(fields[0], "%d", &rx)
				fmt.Sscanf(fields[8], "%d", &tx)
				return rx, tx
			}
		}
	}
	return 0, 0
}

func (a *App) GetSessionStats() SessionStats {
	a.mu.Lock()
	cfg := a.configFile
	status := a.status
	profileName := a.currentProfile
	startTime := a.connectedAt
	a.mu.Unlock()

	vpnIP, dev := getVPNIP()
	serverIP := getServerIP(cfg)

	duration := int64(0)
	if !startTime.IsZero() && status == "connected" {
		duration = int64(time.Since(startTime).Seconds())
	}

	rx, tx := getDeviceStats(dev)

	if profileName == "" && cfg != "" {
		profileName = filepath.Base(cfg)
	}

	return SessionStats{
		Status:       status,
		ProfileName:  profileName,
		ConfigFile:   filepath.Base(cfg),
		VPNIP:        vpnIP,
		ServerIP:     serverIP,
		Device:       dev,
		DurationSecs: duration,
		BytesIn:      rx,
		BytesOut:     tx,
	}
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

func (a *App) ClearAllSessions() string {
	a.mu.Lock()
	cancel := a.cancel
	a.mu.Unlock()

	if cancel != nil {
		cancel()
	}

	out, _ := exec.Command("openvpn3", "sessions-list").Output()
	lines := strings.Split(string(out), "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "Path:") {
			parts := strings.Fields(trimmed)
			if len(parts) >= 2 {
				path := parts[1]
				exec.Command("openvpn3", "session-manage", "--disconnect", "--path", path).Run()
			}
		}
	}

	exec.Command("pkill", "-f", "openvpn3 session-start").Run()
	exec.Command("openvpn3", "session-manage", "--cleanup").Run()

	a.setStatus("disconnected")
	if a.ctx != nil {
		runtime.EventsEmit(a.ctx, "vpn-log", "\n[!] All OpenVPN sessions cleared & disconnected.\n")
	}
	return "cleared"
}

func (a *App) handleSession(ptmx io.ReadWriteCloser, cmd *exec.Cmd, username, password string) {
	defer ptmx.Close()
	defer func() {
		s := a.GetStatus()
		if s != "connected" && s != "auth_failed" {
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
			if a.ctx != nil {
				runtime.EventsEmit(a.ctx, "vpn-log", chunk)
			}
			lower := strings.ToLower(lineBuf)
			matched := false

			if (strings.Contains(lower, "username") || strings.Contains(lower, "user name")) && !sentUser && username != "" {
				ptmx.Write([]byte(username + "\n"))
				sentUser = true
				matched = true
			} else if strings.Contains(lower, "password") && !sentPass && password != "" {
				ptmx.Write([]byte(password + "\n"))
				sentPass = true
				matched = true
			} else if strings.Contains(lower, "authenticator") || strings.Contains(lower, "challenge") || strings.Contains(lower, "otp") || strings.Contains(lower, "2fa") || strings.Contains(lower, "verification code") {
				a.setStatus("waiting_2fa")
				matched = true
			} else if strings.Contains(lower, "connected") {
				a.setStatus("connected")
				go a.startHealthCheck()
				matched = true
			} else if strings.Contains(lower, "auth_failed") || strings.Contains(lower, "authentication failed") || strings.Contains(lower, "auth failed") {
				a.setStatus("auth_failed")
				return
			}

			if matched {
				lineBuf = ""
			} else if strings.Contains(chunk, "\n") {
				lineBuf = chunk[strings.LastIndex(chunk, "\n")+1:]
			}
		}
		if err != nil {
			break
		}
	}
	if cmd != nil {
		cmd.Wait()
	}
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
