package email

import (
	"errors"
	"strings"
)

// ValidateEmail checks whether the given email address has a valid format.
// It returns an error describing what is wrong, or nil if the format is acceptable.
func ValidateEmail(email string) error {
	if email == "" {
		return errors.New("email must not be empty")
	}

	parts := strings.Split(email, "@")
	if len(parts) != 2 {
		return errors.New("email must contain exactly one @ symbol")
	}

	local := parts[0]
	domain := parts[1]

	if local == "" {
		return errors.New("email local part must not be empty")
	}

	if domain == "" {
		return errors.New("email domain part must not be empty")
	}

	if !strings.Contains(domain, ".") {
		return errors.New("email domain must contain a dot")
	}

	return nil
}
