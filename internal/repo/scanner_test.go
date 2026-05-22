package repo

import "testing"

func TestNewBuildingLanguage(t *testing.T) {
	cases := []struct {
		name     string
		relPath  string
		ext      string
		wantLang string
	}{
		// existing extensions
		{"go file", "cmd/main.go", ".go", "go"},
		{"ts file", "web/src/app.ts", ".ts", "ts"},
		{"tsx file", "web/src/App.tsx", ".tsx", "tsx"},
		{"py file", "scripts/run.py", ".py", "py"},
		{"rs file", "src/main.rs", ".rs", "rs"},
		{"yaml file", "config.yaml", ".yaml", "yaml"},
		{"yml file", "config.yml", ".yml", "yaml"},
		{"json file", "package.json", ".json", "json"},
		{"sh file", "build.sh", ".sh", "sh"},
		{"bash file", "setup.bash", ".bash", "sh"},
		{"zsh file", "rc.zsh", ".zsh", "sh"},
		// new extensions
		{"env file", ".env.example", ".env", "env"},
		{"lock file", "go.sum", ".sum", "sum"},
		{"gradle file", "build.gradle", ".gradle", "gradle"},
		{"hcl file", "main.hcl", ".hcl", "hcl"},
		{"nix file", "flake.nix", ".nix", "nix"},
		{"zig file", "src/main.zig", ".zig", "zig"},
		{"dart file", "lib/main.dart", ".dart", "dart"},
		{"elixir ex file", "lib/app.ex", ".ex", "elixir"},
		{"elixir exs file", "config/config.exs", ".exs", "elixir"},
		{"haskell file", "Main.hs", ".hs", "haskell"},
		{"ocaml file", "main.ml", ".ml", "ocaml"},
		{"php file", "index.php", ".php", "php"},
		{"perl file", "script.pl", ".pl", "perl"},
		{"powershell file", "deploy.ps1", ".ps1", "powershell"},
		{"gitignore file", ".gitignore", ".gitignore", "gitignore"},
		{"dockerignore file", ".dockerignore", ".dockerignore", "gitignore"},
		// extensionless known filenames
		{"Dockerfile", "Dockerfile", "", "dockerfile"},
		{"Makefile", "Makefile", "", "makefile"},
		{"Justfile", "Justfile", "", "makefile"},
		{"Rakefile", "Rakefile", "", "ruby"},
		{"Gemfile", "Gemfile", "", "ruby"},
		{"Vagrantfile", "Vagrantfile", "", "ruby"},
		{"nested Dockerfile", "infra/docker/Dockerfile", "", "dockerfile"},
		// unknown extension
		{"unknown ext", "file.xyz", ".xyz", "unknown"},
		// unknown extensionless
		{"unknown extensionless", "OWNERS", "", "unknown"},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			b := newBuilding(tc.relPath, tc.ext, 10)
			if b.Language != tc.wantLang {
				t.Errorf("newBuilding(%q, %q) language = %q, want %q", tc.relPath, tc.ext, b.Language, tc.wantLang)
			}
		})
	}
}

func TestExtensionToLanguageMap(t *testing.T) {
	for name, lang := range filenameToLanguage {
		if lang == "" {
			t.Errorf("filenameToLanguage[%q] is empty", name)
		}
	}
	for ext, lang := range extensionToLanguage {
		if lang == "" {
			t.Errorf("extensionToLanguage[%q] is empty", ext)
		}
	}
}
