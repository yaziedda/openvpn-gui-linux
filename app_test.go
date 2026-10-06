package main

import (
	"bytes"
	"io"
	"sync"
	"testing"
	"time"
)

type blockingMockPTY struct {
	rPipe   *io.PipeReader
	wPipe   *io.PipeWriter
	outBuf  bytes.Buffer
	mu      sync.Mutex
	step    int
	onWrite func(step int, data string) string
}

func newBlockingMockPTY(initialInput string, onWrite func(step int, data string) string) *blockingMockPTY {
	r, w := io.Pipe()
	m := &blockingMockPTY{
		rPipe:   r,
		wPipe:   w,
		onWrite: onWrite,
	}
	if initialInput != "" {
		go func() {
			w.Write([]byte(initialInput))
		}()
	}
	return m
}

func (m *blockingMockPTY) Read(p []byte) (n int, err error) {
	return m.rPipe.Read(p)
}

func (m *blockingMockPTY) Write(p []byte) (n int, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.outBuf.Write(p)
	m.step++
	if m.onWrite != nil {
		next := m.onWrite(m.step, string(p))
		if next != "" {
			go func() {
				m.wPipe.Write([]byte(next))
			}()
		}
	}
	return len(p), nil
}

func (m *blockingMockPTY) Close() error {
	m.wPipe.Close()
	return m.rPipe.Close()
}

func TestHandleSession_AuthUserNamePrompt(t *testing.T) {
	app := NewApp()

	var mock *blockingMockPTY
	mock = newBlockingMockPTY("Using configuration profile from file: /test/client.ovpn\r\nSession path: /net/openvpn/v3/sessions/12345\r\nAuth User name: ", func(step int, data string) string {
		go func() {
			time.Sleep(10 * time.Millisecond)
			mock.Close()
		}()
		return ""
	})

	app.handleSession(mock, nil, "myuser", "mypass")

	mock.mu.Lock()
	written := mock.outBuf.String()
	mock.mu.Unlock()

	if written != "myuser\n" {
		t.Fatalf("expected 'myuser\\n', got %q", written)
	}
}

func TestHandleSession_UsernameAndPasswordFlowWith2FA(t *testing.T) {
	app := NewApp()

	var mock *blockingMockPTY
	var statusDuring2FA string

	mock = newBlockingMockPTY("Auth User name: ", func(step int, data string) string {
		if step == 1 && data == "testuser\n" {
			return "Auth Password: "
		}
		if step == 2 && data == "secretpass\n" {
			go func() {
				for i := 0; i < 50; i++ {
					if app.GetStatus() == "waiting_2fa" {
						statusDuring2FA = app.GetStatus()
						app.SendOTP("654321")
						return
					}
					time.Sleep(5 * time.Millisecond)
				}
			}()
			return "Enter Authenticator Code: "
		}
		if step == 3 && data == "654321\n" {
			go func() {
				time.Sleep(10 * time.Millisecond)
				mock.Close()
			}()
			return "Connected to VPN server successfully\n"
		}
		return ""
	})
	app.ptmx = mock

	app.handleSession(mock, nil, "testuser", "secretpass")

	mock.mu.Lock()
	written := mock.outBuf.String()
	mock.mu.Unlock()

	expected := "testuser\nsecretpass\n654321\n"
	if written != expected {
		t.Fatalf("expected %q, got %q", expected, written)
	}

	if statusDuring2FA != "waiting_2fa" {
		t.Fatalf("expected status during 2FA 'waiting_2fa', got %q", statusDuring2FA)
	}

	if app.GetStatus() != "connected" {
		t.Fatalf("expected final status 'connected', got %q", app.GetStatus())
	}
}

func TestHandleSession_AuthFailed(t *testing.T) {
	app := NewApp()

	var mock *blockingMockPTY
	mock = newBlockingMockPTY("Auth User name: ", func(step int, data string) string {
		if step == 1 {
			return "Auth Password: "
		}
		if step == 2 {
			go func() {
				time.Sleep(10 * time.Millisecond)
				mock.Close()
			}()
			return "AUTH_FAILED: Authentication failed\n"
		}
		return ""
	})

	app.handleSession(mock, nil, "testuser", "secretpass")

	if app.GetStatus() != "auth_failed" {
		t.Fatalf("expected status 'auth_failed', got %q", app.GetStatus())
	}
}

func TestHandleSession_Connected(t *testing.T) {
	app := NewApp()

	var mock *blockingMockPTY
	mock = newBlockingMockPTY("Auth User name: ", func(step int, data string) string {
		if step == 1 {
			return "Auth Password: "
		}
		if step == 2 {
			go func() {
				time.Sleep(10 * time.Millisecond)
				mock.Close()
			}()
			return "Connected to VPN server successfully\n"
		}
		return ""
	})

	app.handleSession(mock, nil, "testuser", "secretpass")

	if app.GetStatus() != "connected" {
		t.Fatalf("expected status 'connected', got %q", app.GetStatus())
	}
}

func TestClearAllSessions(t *testing.T) {
	app := NewApp()
	app.setStatus("connected")

	res := app.ClearAllSessions()
	if res != "cleared" {
		t.Fatalf("expected 'cleared', got %q", res)
	}

	if app.GetStatus() != "disconnected" {
		t.Fatalf("expected status 'disconnected', got %q", app.GetStatus())
	}
}
