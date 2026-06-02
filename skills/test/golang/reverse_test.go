package reverse

import "testing"

func TestReverse(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "empty string",
			input: "",
			want:  "",
		},
		{
			name:  "single ASCII character",
			input: "a",
			want:  "a",
		},
		{
			name:  "ASCII string",
			input: "hello",
			want:  "olleh",
		},
		{
			name:  "palindrome",
			input: "racecar",
			want:  "racecar",
		},
		{
			name:  "Unicode multi-byte characters",
			input: "Hello, 世界", //nolint:gosmopolitan
			want:  "界世 ,olleH", //nolint:gosmopolitan
		},
		{
			name:  "string with spaces",
			input: "a b c",
			want:  "c b a",
		},
		{
			name:  "mixed ASCII and Unicode",
			input: "café",
			want:  "éfac",
		},
	}

	for _, tt := range tests {
		tt := tt //nolint:modernize // required for Go 1.21: loop var capture before parallel subtest
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := Reverse(tt.input)
			if got != tt.want {
				t.Errorf("Reverse(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}
