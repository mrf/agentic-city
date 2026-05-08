// Package web exposes the embedded frontend dist bundle.
package web

import "embed"

//go:embed dist
var Dist embed.FS
