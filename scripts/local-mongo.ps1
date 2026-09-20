$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$mongoBinary = 'C:\Program Files\MongoDB\Server\8.0\bin\mongod.exe'
if (-not (Test-Path -LiteralPath $mongoBinary)) { throw 'Set $mongoBinary in scripts/local-mongo.ps1 to your installed mongod.exe.' }
New-Item -ItemType Directory -Force -Path '.data/mongo' | Out-Null
& $mongoBinary --dbpath '.data/mongo' --replSet ekharid --bind_ip 127.0.0.1 --port 27018 --logpath '.data/mongo.log'
