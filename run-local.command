#!/bin/zsh
set -e
cd -- "${0:A:h}"
if [[ ! -d node_modules ]]; then
  npm ci
fi
if [[ ! -f public/app.js || ! -f public/styles.css ]]; then
  npm run build
fi
npm start
