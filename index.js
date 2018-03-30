const puppeteer = require('puppeteer')
const credentials = require('./credentials')
const ora = require('ora')
const fs = require('fs')

const spinner = ora()

async function run () {
  // Setup ---------------------------------------------------------------------
  const output = './wishlists.json'

  const browser = await puppeteer.launch({
    headless: true
  })

  const page = await browser.newPage()

  // Login ---------------------------------------------------------------------
  spinner.start(`Logging in as ${credentials.username}`)
  await page.goto('https://www.bookdepository.com/account/login')

  await page.click('#username')
  await page.keyboard.type(credentials.username)

  await page.click('#loginPassword')
  await page.keyboard.type(credentials.password)

  await page.click('form.form-horizontal.login-form button.btn.btn-primary')
  await page.waitForNavigation()

  // Wishlists -----------------------------------------------------------------
  await page.goto('https://www.bookdepository.com/account/wishlist')

  spinner.succeed('Logged in')
  spinner.start('Getting list of wishlists')

  const wishlists = await page.$$eval(
    'ul.wishlist-links.sidebar-nav li a',
    links => {
      return links.reduce((acc, link) => {
        const id = link.href.match(/wishlistId=(\d+)/)[1]
        const name = link.children[0].innerText

        acc[id] = { name: name }

        return acc
      }, {})
    }
  )

  const ids = Object.keys(wishlists)

  spinner.succeed(
    `Found ${Object.keys(wishlists).length} wishlists: ${ids
      .map(id => wishlists[id].name)
      .join(', ')}`
  )

  var comp = 1

  for (const id of ids) {
    spinner.start(
      `Scraping ${comp}/${ids.length}: ${wishlists[id].name} (${id})`
    )

    await page.goto(
      `https://www.bookdepository.com/account/wishlist?wishlistId=${id}`
    )

    const pages = await page.$$('ul.pagination:nth-child(2) > li')
    /* l is the number of pages. Wishlists with only 1 page will not have the
     * pagination elements.
     *
     * n is the buffer for the next arrow found using the selector above.
     */
    const [l, n] =
      pages === null || pages.length === 0 ? [1, 0] : [pages.length, 1]

    // - n because we're on the last page.
    for (var i = 0; i < l - n; i++) {
      spinner.start(
        `Scraping ${comp}/${ids.length}: ${
          wishlists[id].name
        } (${id}) - Page ${i + 1} of ${l - 1}`
      )

      await page.waitFor('.wishlist-items')

      const books = await page.$$eval(
        '.wishlist-items .book-list-item .item-info-wrap',
        items => {
          return items.map(item => {
            const itemInfo = Array.from(item.children).find(
              value => value.className === 'item-info'
            )
            const itemInfoChildren = Array.from(itemInfo.children)

            return {
              title: itemInfoChildren.find(
                value => value.className === 'item-title'
              ).innerText,
              author: itemInfoChildren
                .find(value => value.className === 'author')
                .innerText.replace('By ', '')
            }
          })
        }
      )

      if (wishlists[id].hasOwnProperty('books')) {
        wishlists[id].books = wishlists[id].books.concat(books)
      } else {
        wishlists[id].books = books
      }

      // Check if there are any more pages in this wishlist
      if (i === l - n) {
        postSingleChk(spinner, wishlists[id], id)
        break
      }

      const next = await page.$('#next-top > a')
      if (next === null) {
        postSingleChk(spinner, wishlists[id], id)
        break
      }

      await next.click()
    }

    spinner.succeed(
      `Scraped ${comp}/${ids.length}: ${wishlists[id].name} (${id})`
    )

    comp++
  }

  // Teardown ------------------------------------------------------------------
  await browser.close()

  // Export --------------------------------------------------------------------
  spinner.start(`Writing results to ${output}`)
  fs.unlinkSync(output)
  fs.writeFile(output, JSON.stringify(wishlists, null, 2), err => {
    if (err) {
      spinner.fail(`Failed to write results to ${output}: ${err}`)
      return
    }
    spinner.succeed(`Wrote results to ${output}`)
  })
}

run()
  .then(() => {})
  .catch(err => spinner.fail(`Failed to scrape wishlists: ${err}`))

const postSingleChk = (spinner, wishlist, id) => {
  if (!wishlist.hasOwnProperty('books') || wishlist.books.length === 0) {
    spinner.fail(`Found no books for ${wishlist.name} (${id})`)
  }
}
