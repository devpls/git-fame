## [0.2.3](https://github.com/devpls/git-fame/compare/v0.2.2...v0.2.3) (2026-04-12)

### Bug Fixes

- include root path in recursive mode when it is a git repo ([ffabc48](https://github.com/devpls/git-fame/commit/ffabc485fe82d5a97e16aeed40964ac374825659))
- read version from package.json and use lowercase -v flag ([db3243e](https://github.com/devpls/git-fame/commit/db3243e6739bc47495ac5c8c432b71fcc91bb8de))

## [0.2.2](https://github.com/devpls/git-fame/compare/v0.2.1...v0.2.2) (2026-04-11)

### Bug Fixes

- spawn git blame directly to fix Windows hang ([78b6741](https://github.com/devpls/git-fame/commit/78b67410416bd2ccc1f73eb457fed940ee03dfbd))

# [0.2.0](https://github.com/devpls/git-fame/compare/v0.1.0...v0.2.0) (2026-04-10)

### Bug Fixes

- reset progress bar between repos and show repo name ([97f2c94](https://github.com/devpls/git-fame/commit/97f2c94518ff18c0485fca5b44dd1c2aa5f1545e))

### Features

- add .gitfamerc config file support ([8d8e66c](https://github.com/devpls/git-fame/commit/8d8e66cc41a9c0d9f6c12d1fc7234b45183340ab))
- add result caching by commit SHA with --no-cache flag ([a2b8efe](https://github.com/devpls/git-fame/commit/a2b8efe3df3904c4b4525377248f93535abcfd47))
- support multiple --include-globs and --exclude-globs flags ([b8d228a](https://github.com/devpls/git-fame/commit/b8d228a56c6c25f69e6fecdf3b77597ff3d6da51))

### Performance Improvements

- optimize blame with counting parser, precompiled matchers, dynamic queue ([ad5b6ee](https://github.com/devpls/git-fame/commit/ad5b6ee70f2af7550e3d755d9eb9616525dd8135))
