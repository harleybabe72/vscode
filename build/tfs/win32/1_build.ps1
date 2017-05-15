Param(
   [string]$mixinPassword
)

. .\build\tfs\win32\lib.ps1

STEP "Install dependencies"
exec { & .\scripts\npm.bat install --arch=ia32 }

STEP "Mix in repository from vscode-distro"
$env:VSCODE_MIXIN_PASSWORD = $mixinPassword
exec { & npm run gulp -- mixin }

STEP "Get Electron"
exec { & npm run gulp -- electron-ia32 }

STEP "Build minified"
exec { & npm run gulp -- --max_old_space_size=4096 vscode-win32-min }

STEP "Run unit tests"
exec { & .\scripts\test.bat --build --reporter dot }

# STEP "Run integration tests"
# exec { & .\scripts\test-integration.bat }