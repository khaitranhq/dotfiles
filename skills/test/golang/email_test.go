package email

import (
	"strings"
	"testing"
)

func TestValidateEmail(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		email   string
		wantErr bool
		errMsg  string
	}{
		{
			name:    "valid standard email",
			email:   "user@example.com",
			wantErr: false,
		},
		{
			name:    "valid email with subdomain",
			email:   "user@mail.example.com",
			wantErr: false,
		},
		{
			name:    "valid email with plus sign",
			email:   "user+tag@example.com",
			wantErr: false,
		},
		{
			name:    "empty string",
			email:   "",
			wantErr: true,
			errMsg:  "empty",
		},
		{
			name:    "missing @ symbol",
			email:   "userexample.com",
			wantErr: true,
			errMsg:  "@",
		},
		{
			name:    "multiple @ symbols",
			email:   "user@host@example.com",
			wantErr: true,
			errMsg:  "@",
		},
		{
			name:    "missing local part",
			email:   "@example.com",
			wantErr: true,
			errMsg:  "local",
		},
		{
			name:    "missing domain part",
			email:   "user@",
			wantErr: true,
			errMsg:  "domain",
		},
		{
			name:    "domain missing dot",
			email:   "user@example",
			wantErr: true,
			errMsg:  "domain",
		},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			err := ValidateEmail(tt.email)
			if tt.wantErr {
				if err == nil {
					t.Fatalf("ValidateEmail(%q) expected error, got nil", tt.email)
				}
				if !strings.Contains(err.Error(), tt.errMsg) {
					t.Errorf("ValidateEmail(%q) error = %q, want error containing %q", tt.email, err.Error(), tt.errMsg)
				}
			} else {
				if err != nil {
					t.Fatalf("ValidateEmail(%q) unexpected error: %v", tt.email, err)
				}
			}
		})
	}
}
