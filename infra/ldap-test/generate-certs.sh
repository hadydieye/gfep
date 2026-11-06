#!/usr/bin/env bash
# Génère une CA et un certificat serveur auto-signés pour le LDAP de test (LDAPS).
# Fichiers écrits dans infra/ldap-test/certs/, non versionnés. Test uniquement :
# en production, la CA est celle du contrôleur de domaine (TODO(AD-REVISION)).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p certs
cd certs
if [[ -f ca.crt && -f ldap.crt && -f ldap.key ]]; then
  echo "Certificats déjà présents dans $(pwd) (supprimez-les pour régénérer)."
  exit 0
fi
openssl req -x509 -newkey rsa:2048 -nodes -days 825 -subj "/CN=GFEP LDAP de test CA" \
  -keyout ca.key -out ca.crt 2>/dev/null
openssl req -newkey rsa:2048 -nodes -subj "/CN=localhost" -keyout ldap.key -out ldap.csr 2>/dev/null
cat > ldap.ext <<'EXT'
basicConstraints=CA:FALSE
keyUsage=digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:localhost,DNS:ldap-test,IP:127.0.0.1
EXT
openssl x509 -req -in ldap.csr -CA ca.crt -CAkey ca.key -CAcreateserial -days 825 \
  -extfile ldap.ext -out ldap.crt 2>/dev/null
rm -f ldap.csr ldap.ext ca.srl
chmod 644 ca.crt ldap.crt ldap.key
echo "CA et certificat serveur générés dans $(pwd)."
