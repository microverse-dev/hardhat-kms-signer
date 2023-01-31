#!/bin/bash

echo "Enter a NPM_TOKEN: "
read NPM_TOKEN

echo "Enter a GITHUB_TOKEN: "
read GITHUB_TOKEN

NPM_TOKEN=$NPM_TOKEN GITHUB_TOKEN=$GITHUB_TOKEN pnpm semantic-release --no-ci