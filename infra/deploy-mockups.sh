#!/usr/bin/env bash
#
# Deploy design/react-mockups to the staging host.
#
# There is no pipeline and no git checkout on the server: the image is built HERE from
# the current working tree, saved to a tar, transferred, and loaded there. This script is
# the runbook in infra/README.md, minus the two mistakes that runbook exists to prevent —
# running a local command inside an SSH session, and reaching the host by a name that has
# no DNS.
#
# Usage:
#   ./infra/deploy-mockups.sh              # build, test, confirm, deploy
#   ./infra/deploy-mockups.sh --yes        # no confirmation prompt
#   ./infra/deploy-mockups.sh --no-build   # reuse the image already tagged for this commit
#   ./infra/deploy-mockups.sh --rollback   # put :previous back on the server
#
# Overridable by environment variable, e.g. HOST=172.28.89.9 ./infra/deploy-mockups.sh
#
set -euo pipefail

HOST=${HOST:-172.28.89.6}            # oer-sbd-bend-01 — the short name does not resolve
EXPECT_HOSTNAME=${EXPECT_HOSTNAME:-oer-sbd-bend-01}
SSH_USER=${SSH_USER:-adelvalle}
SSH_KEY=${SSH_KEY:-$HOME/.ssh/OCS}   # required; these hosts refuse password auth
IMAGE=${IMAGE:-sentiboard-mockups}
CONTAINER=${CONTAINER:-sentiboard-mockups}
PORT=${PORT:-3000}                   # the only port known to be open on that host
TEST_PORT=${TEST_PORT:-3999}         # local smoke test only; avoids clashing with $PORT
VITE_BASE=${VITE_BASE:-/}            # must end in a slash; baked in, needs a rebuild to change

ASSUME_YES=0
SKIP_BUILD=0
ROLLBACK=0
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y)   ASSUME_YES=1 ;;
    --no-build) SKIP_BUILD=1 ;;
    --rollback) ROLLBACK=1 ;;
    --help|-h)  sed -n '3,20p' "$0"; exit 0 ;;
    *) echo "unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done

say()  { printf '\n\033[1m== %s\033[0m\n' "$*"; }
fail() { printf '\n\033[31mFAILED: %s\033[0m\n' "$*" >&2; exit 1; }

SSH="ssh -i $SSH_KEY ${SSH_USER}@${HOST}"

# ---------------------------------------------------------------- rollback
if [ "$ROLLBACK" = 1 ]; then
  say "Rolling back $CONTAINER on $HOST to :previous"
  # shellcheck disable=SC2086
  $SSH -t "sudo docker rm -f $CONTAINER; \
           sudo docker run -d --restart always -p $PORT:8080 --name $CONTAINER $IMAGE:previous" \
    || fail "rollback failed"
  say "Rolled back. Serving:"
  curl -s -m 10 "http://$HOST:$PORT/" | grep -oE 'src="/assets/[^"]*"' || true
  exit 0
fi

# ---------------------------------------------------------------- preflight
cd "$(git rev-parse --show-toplevel)" || fail "not inside a git repository"
[ -f "$SSH_KEY" ] || fail "ssh key not found at $SSH_KEY (set SSH_KEY=...)"

SHA=$(git rev-parse --short HEAD)
SUBJECT=$(git log -1 --format=%s)
TAR=/tmp/${IMAGE}-${SHA}.tar

say "Deploying $SHA to ${SSH_USER}@${HOST}:${PORT}"
echo "  commit:  $SHA  $SUBJECT"
echo "  image:   $IMAGE:$SHA (also tagged :latest)"

# docker build reads the working tree, not the commit, so anything uncommitted ships too
# and the deployed image then corresponds to no commit. Worth knowing, not worth blocking.
DIRTY=$(git status --porcelain -- design/react-mockups infra/dockerfiles infra/nginx)
if [ -n "$DIRTY" ]; then
  printf '\n\033[33m  warning: uncommitted changes will be baked into the image:\033[0m\n'
  echo "$DIRTY" | sed 's/^/    /'
fi

# ---------------------------------------------------------------- build
if [ "$SKIP_BUILD" = 1 ]; then
  docker image inspect "$IMAGE:$SHA" >/dev/null 2>&1 \
    || fail "--no-build given but $IMAGE:$SHA does not exist locally"
  say "Reusing existing image $IMAGE:$SHA"
else
  say "Building $IMAGE:$SHA"
  BUILD_ARGS=(--build-arg "VITE_BASE=$VITE_BASE")
  # Only needed where the build runs, and only behind the Serco proxy. npm ci is the
  # single step that reaches the network; nothing at runtime does.
  [ -n "${HTTP_PROXY:-}"  ] && BUILD_ARGS+=(--build-arg "HTTP_PROXY=$HTTP_PROXY")
  [ -n "${HTTPS_PROXY:-}" ] && BUILD_ARGS+=(--build-arg "HTTPS_PROXY=$HTTPS_PROXY")
  docker build "${BUILD_ARGS[@]}" \
    -f infra/dockerfiles/mockups.Dockerfile \
    -t "$IMAGE:$SHA" -t "$IMAGE:latest" . \
    || fail "build failed — nothing was sent to the server"
fi

# The bundle filename is content-hashed, so it is the only reliable proof that what ends up
# live is what we just built. A 200 proves nothing: the old container returns one too.
asset_of_image() {
  local cid out
  cid=$(docker create "$1")
  out=$(docker cp "$cid:/usr/share/nginx/html/index.html" - 2>/dev/null | tar -xO 2>/dev/null | grep -oE 'src="/assets/[^"]*\.js"' | head -1)
  docker rm "$cid" >/dev/null
  printf '%s' "$out"
}
EXPECT_ASSET=$(asset_of_image "$IMAGE:$SHA")
[ -n "$EXPECT_ASSET" ] || fail "could not read the asset hash out of the image"
echo "  bundle:  $EXPECT_ASSET"

# ---------------------------------------------------------------- local smoke test
say "Smoke testing locally on :$TEST_PORT"
docker rm -f "${CONTAINER}-test" >/dev/null 2>&1 || true
docker run -d --rm -p "$TEST_PORT:8080" --name "${CONTAINER}-test" "$IMAGE:$SHA" >/dev/null
cleanup_test() { docker stop "${CONTAINER}-test" >/dev/null 2>&1 || true; }
trap cleanup_test EXIT

for _ in 1 2 3 4 5 6 7 8 9 10; do
  curl -sf -o /dev/null "http://localhost:$TEST_PORT/" && break
  sleep 1
done

# Deep links are what break with a misconfigured SPA, and they are exactly what gets
# shared. Every declared route is checked, so a broken new page fails here, not in a demo.
ROUTES=$(grep -oE 'path="/[^"*]*"' design/react-mockups/src/App.tsx \
         | sed 's/path="//;s/"//' | sort -u)
FAILED=0
for r in $ROUTES; do
  code=$(curl -s -m 5 -o /dev/null -w '%{http_code}' "http://localhost:$TEST_PORT$r")
  [ "$code" = "200" ] || { printf '  \033[31m%-44s %s\033[0m\n' "$r" "$code"; FAILED=1; }
done
cleanup_test
trap - EXIT
[ "$FAILED" = 0 ] || fail "some routes did not return 200 — not deploying"
echo "  all $(echo "$ROUTES" | wc -l) routes returned 200"

# ---------------------------------------------------------------- confirm
if [ "$ASSUME_YES" != 1 ]; then
  say "Ready to deploy to $HOST — this replaces the running container"
  echo "  currently live: $(curl -s -m 10 "http://$HOST:$PORT/" | grep -oE 'src="/assets/[^"]*\.js"' | head -1 || echo unreachable)"
  echo "  will become:    $EXPECT_ASSET"
  printf '\nContinue? [y/N] '
  read -r reply
  case "$reply" in [yY]*) ;; *) echo "aborted; nothing was sent"; exit 0 ;; esac
fi

# ---------------------------------------------------------------- transfer
say "Transferring image to $HOST"
docker save -o "$TAR" "$IMAGE:$SHA" "$IMAGE:latest" || fail "docker save failed"
LOCAL_BYTES=$(stat -c %s "$TAR")
echo "  tar: $(du -h "$TAR" | cut -f1)"

# The transfer is the slow step (~70s on the VPN) and it is idempotent, so a re-run after a
# failure further down should not pay for it twice. Sizes matching is enough: the tar is
# named after the commit, so a same-name same-size file is the same build.
# shellcheck disable=SC2086
REMOTE_BYTES=$($SSH "stat -c %s '$TAR' 2>/dev/null || echo 0" 2>/dev/null || echo 0)
if [ "$REMOTE_BYTES" = "$LOCAL_BYTES" ]; then
  echo "  already on $HOST with the same size — skipping scp"
else
  scp -i "$SSH_KEY" "$TAR" "${SSH_USER}@${HOST}:/tmp/" || fail "scp failed — is the VPN up?"
fi

# ---------------------------------------------------------------- remote half
# Sent as a file rather than an inline command so quoting cannot mangle it. -t gives sudo
# a terminal to prompt on.
REMOTE=$(mktemp)
cat >"$REMOTE" <<REMOTE_SCRIPT
set -euo pipefail
REMOTE_FQDN=\$(hostname)
echo "  hostname: \$REMOTE_FQDN"
# The host answers with its FQDN (oer-sbd-bend-01.ocs.local), so compare the first label
# only. This guard exists to stop a deploy landing on the Flask host by mistake, not to
# police the domain.
if [ "\${REMOTE_FQDN%%.*}" != "${EXPECT_HOSTNAME%%.*}" ]; then
  echo "  refusing: expected ${EXPECT_HOSTNAME%%.*}, got \${REMOTE_FQDN%%.*}" >&2; exit 1
fi
[ -f "$TAR" ] || { echo "  tar missing at $TAR" >&2; exit 1; }

# Tag before loading: a new :latest detaches the name from the running image, and the
# rollback would otherwise survive only as an untagged ID.
sudo docker tag $IMAGE:latest $IMAGE:previous 2>/dev/null \
  || echo "  (no existing :latest to preserve — first deploy?)"

sudo docker load -i "$TAR"
sudo docker rm -f $CONTAINER 2>/dev/null || true
sudo docker run -d --restart always -p $PORT:8080 --name $CONTAINER $IMAGE:latest
sleep 2
sudo docker ps --filter name=$CONTAINER --format '  running: {{.Image}} {{.Status}} {{.Ports}}'
curl -sf -o /dev/null -w '  local check: %{http_code}\n' http://localhost:$PORT/
rm -f "$TAR"
REMOTE_SCRIPT

say "Loading and restarting on $HOST (sudo may prompt)"
scp -q -i "$SSH_KEY" "$REMOTE" "${SSH_USER}@${HOST}:/tmp/deploy-mockups-remote.sh"
rm -f "$REMOTE"
# shellcheck disable=SC2086
$SSH -t "bash /tmp/deploy-mockups-remote.sh; rm -f /tmp/deploy-mockups-remote.sh" \
  || fail "remote deploy failed — the previous container may be stopped; see --rollback"

# ---------------------------------------------------------------- verify
say "Verifying from here"
LIVE=$(curl -s -m 15 "http://$HOST:$PORT/" | grep -oE 'src="/assets/[^"]*\.js"' | head -1)
echo "  expected: $EXPECT_ASSET"
echo "  live:     $LIVE"
rm -f "$TAR"

if [ "$LIVE" = "$EXPECT_ASSET" ]; then
  printf '\n\033[32mDeployed %s to http://%s:%s/\033[0m\n' "$SHA" "$HOST" "$PORT"
  echo "Roll back with: $0 --rollback"
else
  fail "the live bundle is not the one just built — the old container may still be serving"
fi
