package deps

import (
	"sort"
	"testing"

	"github.com/mferree/agent-city/internal/model"
)

// ---- ExtractImports tests ----------------------------------------------------

func TestExtractImportsTS(t *testing.T) {
	content := `
import React from 'react';
import { useState, useEffect } from 'react';
import type { FC } from 'react';
import * as utils from './utils';
import './styles.css';
export { foo } from '../shared/foo';
const mod = require('./legacy');
const lazy = import('./lazy');
`
	got := paths(ExtractImports("ts", content))
	want := []string{"react", "./utils", "./styles.css", "../shared/foo", "./legacy", "./lazy"}
	assertSubset(t, "ts imports", want, got)
}

func TestExtractImportsTSX(t *testing.T) {
	content := `import App from './App';`
	got := paths(ExtractImports("tsx", content))
	if len(got) != 1 || got[0] != "./App" {
		t.Errorf("tsx: want [./App], got %v", got)
	}
}

func TestExtractImportsGo(t *testing.T) {
	content := `
package main

import (
	"fmt"
	"os"

	"github.com/mferree/agent-city/internal/model"
	alias "github.com/mferree/agent-city/internal/layout"
)

import "strings"
`
	got := paths(ExtractImports("go", content))
	want := []string{
		"fmt",
		"os",
		"github.com/mferree/agent-city/internal/model",
		"github.com/mferree/agent-city/internal/layout",
		"strings",
	}
	assertSubset(t, "go imports", want, got)
}

func TestExtractImportsPython(t *testing.T) {
	content := `
import os
import sys
import foo.bar
from pathlib import Path
from .relative import something
from ..parent import other
`
	got := paths(ExtractImports("py", content))
	want := []string{"os", "sys", "foo.bar", "pathlib", ".relative", "..parent"}
	assertSubset(t, "py imports", want, got)
}

func TestExtractImportsUnknownLang(t *testing.T) {
	got := ExtractImports("rust", `use std::io;`)
	if got != nil {
		t.Errorf("unknown lang: want nil, got %v", got)
	}
}

// ---- resolveJS tests ---------------------------------------------------------

func TestResolveJSRelativeExact(t *testing.T) {
	known := map[string]bool{"src/auth/utils.ts": true}
	id, conf := resolveJS("src/auth/session.ts", "./utils.ts", known)
	if id != "src/auth/utils.ts" || conf != "exact" {
		t.Errorf("exact: got (%s, %s)", id, conf)
	}
}

func TestResolveJSRelativeInferred(t *testing.T) {
	known := map[string]bool{"src/auth/utils.ts": true}
	id, conf := resolveJS("src/auth/session.ts", "./utils", known)
	if id != "src/auth/utils.ts" || conf != "inferred" {
		t.Errorf("inferred ext: got (%s, %s)", id, conf)
	}
}

func TestResolveJSIndexFile(t *testing.T) {
	known := map[string]bool{"src/auth/components/index.tsx": true}
	id, conf := resolveJS("src/auth/session.ts", "./components", known)
	if id != "src/auth/components/index.tsx" || conf != "inferred" {
		t.Errorf("index: got (%s, %s)", id, conf)
	}
}

func TestResolveJSThirdParty(t *testing.T) {
	known := map[string]bool{}
	id, conf := resolveJS("src/App.tsx", "react", known)
	if id != "" || conf != "" {
		t.Errorf("third-party: want empty, got (%s, %s)", id, conf)
	}
}

func TestResolveJSUnresolved(t *testing.T) {
	known := map[string]bool{}
	id, conf := resolveJS("src/auth/session.ts", "./missing", known)
	if id != "" || conf != "" {
		t.Errorf("unresolved: want empty, got (%s, %s)", id, conf)
	}
}

// ---- resolveGo tests ---------------------------------------------------------

func TestResolveGoModuleLocal(t *testing.T) {
	dirFiles := map[string][]string{
		"internal/model": {"internal/model/model.go"},
	}
	id, conf := resolveGo(
		"github.com/mferree/agent-city/internal/model",
		"github.com/mferree/agent-city",
		dirFiles,
	)
	if id != "internal/model/model.go" || conf != "inferred" {
		t.Errorf("go module: got (%s, %s)", id, conf)
	}
}

func TestResolveGoStdlib(t *testing.T) {
	id, conf := resolveGo("fmt", "github.com/mferree/agent-city", map[string][]string{})
	if id != "" || conf != "" {
		t.Errorf("stdlib: want empty, got (%s, %s)", id, conf)
	}
}

func TestResolveGoNoModuleName(t *testing.T) {
	id, conf := resolveGo("github.com/mferree/agent-city/internal/model", "", map[string][]string{})
	if id != "" || conf != "" {
		t.Errorf("no module name: want empty, got (%s, %s)", id, conf)
	}
}

// ---- resolvePython tests -----------------------------------------------------

func TestResolvePythonAbsolute(t *testing.T) {
	known := map[string]bool{"internal/auth/session.py": true}
	id, conf := resolvePython("main.py", "internal.auth.session", known)
	if id != "internal/auth/session.py" || conf != "inferred" {
		t.Errorf("py absolute: got (%s, %s)", id, conf)
	}
}

func TestResolvePythonRelative(t *testing.T) {
	known := map[string]bool{"src/auth/utils.py": true}
	id, conf := resolvePython("src/auth/session.py", ".utils", known)
	if id != "src/auth/utils.py" || conf != "inferred" {
		t.Errorf("py relative: got (%s, %s)", id, conf)
	}
}

func TestResolvePythonRelativeParent(t *testing.T) {
	known := map[string]bool{"src/shared.py": true}
	id, conf := resolvePython("src/auth/session.py", "..shared", known)
	if id != "src/shared.py" || conf != "inferred" {
		t.Errorf("py parent relative: got (%s, %s)", id, conf)
	}
}

// ---- BuildGraph tests --------------------------------------------------------

func TestBuildGraphJS(t *testing.T) {
	buildings := []model.Building{
		{ID: "src/App.tsx", Language: "tsx"},
		{ID: "src/utils.ts", Language: "ts"},
		{ID: "src/index.ts", Language: "ts"},
	}

	files := map[string]string{
		"src/App.tsx": `import { helper } from './utils';`,
		"src/utils.ts": `import { format } from './index';`,
		"src/index.ts": `export const format = () => {};`,
	}

	reader := func(id string) ([]byte, error) {
		return []byte(files[id]), nil
	}

	roads := BuildGraph(buildings, reader, Config{})

	// Expect: App.tsx → utils.ts, utils.ts → index.ts
	roadMap := make(map[string]string)
	for _, r := range roads {
		roadMap[r.FromID] = r.ToID
	}

	if roadMap["src/App.tsx"] != "src/utils.ts" {
		t.Errorf("App.tsx → utils.ts missing; roads: %v", roads)
	}
	if roadMap["src/utils.ts"] != "src/index.ts" {
		t.Errorf("utils.ts → index.ts missing; roads: %v", roads)
	}
}

func TestBuildGraphGoModule(t *testing.T) {
	buildings := []model.Building{
		{ID: "cmd/main.go", Language: "go"},
		{ID: "internal/model/model.go", Language: "go"},
	}

	files := map[string]string{
		"cmd/main.go": `package main
import "github.com/mferree/agent-city/internal/model"
func main() { _ = model.CityState{} }`,
		"internal/model/model.go": `package model
type CityState struct{}`,
	}

	reader := func(id string) ([]byte, error) { return []byte(files[id]), nil }

	roads := BuildGraph(buildings, reader, Config{ModuleName: "github.com/mferree/agent-city"})

	if len(roads) != 1 {
		t.Fatalf("want 1 road, got %d: %v", len(roads), roads)
	}
	r := roads[0]
	if r.FromID != "cmd/main.go" || r.ToID != "internal/model/model.go" {
		t.Errorf("unexpected road: %+v", r)
	}
	if r.Confidence != "inferred" {
		t.Errorf("want inferred, got %s", r.Confidence)
	}
}

func TestBuildGraphDeduplication(t *testing.T) {
	buildings := []model.Building{
		{ID: "a.ts", Language: "ts"},
		{ID: "b.ts", Language: "ts"},
	}
	// a.ts imports b.ts twice (via different specifiers both resolving to the same file).
	files := map[string]string{
		"a.ts": `
import { foo } from './b';
const x = require('./b.ts');
`,
		"b.ts": `export const foo = 1;`,
	}
	reader := func(id string) ([]byte, error) { return []byte(files[id]), nil }

	roads := BuildGraph(buildings, reader, Config{})

	fromA := 0
	for _, r := range roads {
		if r.FromID == "a.ts" && r.ToID == "b.ts" {
			fromA++
			if r.Weight < 2 {
				t.Errorf("want weight>=2 for merged edge, got %d", r.Weight)
			}
		}
	}
	if fromA != 1 {
		t.Errorf("want exactly 1 a→b road after dedup, got %d", fromA)
	}
}

func TestBuildGraphSelfImportSkipped(t *testing.T) {
	buildings := []model.Building{{ID: "src/foo.ts", Language: "ts"}}
	files := map[string]string{
		"src/foo.ts": `import { x } from './foo';`,
	}
	reader := func(id string) ([]byte, error) { return []byte(files[id]), nil }

	roads := BuildGraph(buildings, reader, Config{})
	if len(roads) != 0 {
		t.Errorf("self-import should be skipped; got %v", roads)
	}
}

func TestHighestConfidence(t *testing.T) {
	cases := [][3]string{
		{"exact", "inferred", "exact"},
		{"inferred", "exact", "exact"},
		{"inferred", "weak", "inferred"},
		{"weak", "weak", "weak"},
		{"exact", "exact", "exact"},
	}
	for _, c := range cases {
		got := highestConfidence(c[0], c[1])
		if got != c[2] {
			t.Errorf("highestConfidence(%s, %s) = %s; want %s", c[0], c[1], got, c[2])
		}
	}
}

// ---- helpers -----------------------------------------------------------------

func paths(imports []RawImport) []string {
	out := make([]string, len(imports))
	for i, imp := range imports {
		out[i] = imp.Path
	}
	return out
}

// assertSubset checks that every element in want appears in got.
func assertSubset(t *testing.T, label string, want, got []string) {
	t.Helper()
	gotSet := map[string]bool{}
	for _, g := range got {
		gotSet[g] = true
	}
	for _, w := range want {
		if !gotSet[w] {
			t.Errorf("%s: missing %q; got %v", label, w, sorted(got))
		}
	}
}

func sorted(s []string) []string {
	cp := append([]string(nil), s...)
	sort.Strings(cp)
	return cp
}
