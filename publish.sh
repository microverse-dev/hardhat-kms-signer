#!/bin/bash

echo "Enter a NPM_TOKEN: "
read NPM_TOKEN

echo "Enter a GH_TOKEN: "
read GH_TOKEN

NPM_TOKEN=$NPM_TOKEN GH_TOKEN=$GH_TOKEN npx semantic-release --no-ci