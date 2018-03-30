# Book Depository wishlists exporter

Book Depository doesn't provide a way to export a user's wishlists. This script will export all of a user's wishlists (with pagination support) to a local file for backup. I created this as part of a slow plan to stop unnecessary reliance on third-parties (walled gardens).

## Setup

Run `npm install` or `yarn install`.

## Usage

Create a file called `credentials.js` with the following shape:

```
module.exports = {
  username: 'YOUR_USERNAME',
  password: 'YOUR_PASSWORD'
}
```

Run the script: `npm run export`

## Contributing

Contributions are welcome! Simply create a PR.
