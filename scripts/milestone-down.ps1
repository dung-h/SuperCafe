Param(
  [switch]$PruneVolumes
)

$composeArgs = @("-f", "docker-compose.milestone.yml", "down")
if ($PruneVolumes) {
  $composeArgs += "-v"
}

docker compose @composeArgs

