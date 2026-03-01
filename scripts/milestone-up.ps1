Param(
  [switch]$Build
)

$composeArgs = @("-f", "docker-compose.milestone.yml", "up", "-d")
if ($Build) {
  $composeArgs += "--build"
}

docker compose @composeArgs

