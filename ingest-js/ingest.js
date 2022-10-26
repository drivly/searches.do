import axios from 'axios'
import fs from 'fs'
import cliProgress from 'cli-progress'
import { Client } from 'twitter-api-sdk'

const bearer_token = ``

const download = async () => {
	console.log(`[DL] Downloading tweets...`)
	const client = new Client(bearer_token);

	let next_token = null

	const tweets = []

	// for (let i = 0; i < 10; i++) {
	// 	const { data } = await client.tweets.search({ q: 'cloudflare', count: 100, result_type: 'recent', max_id: tweets[tweets.length - 1]?.id_str })

	// 	tweets.push(...data.statuses)
	// }

	const anti_dupe = []

	const all_tweets = []

	for (let i = 0; i < 50; i++) {
		console.log(`[DL] Downloading page ${i + 1}...`)

		let response = await client.tweets.tweetsRecentSearch({
			next_token,
			query: `car -is:reply -is:retweet lang:en has:media`,
			max_results: 100,
			"expansions": ["attachments.media_keys", "author_id"],
			"tweet.fields": [
				"author_id",
				"attachments",
				"text"
			],
			"media.fields": [
				"url",
				"alt_text"
			]
		})

		const includes = response.includes.media
		const authors = response.includes.users

		next_token = response.meta.next_token

		for (const tweet of response.data) {
			if (anti_dupe.includes(tweet.text)) {
				continue
			}

			anti_dupe.push(tweet.text)

			// Add media from includes into the tweet based on the attachments array
			tweet.media = tweet.attachments?.media_keys.map(key => {
				return includes.find(x => x.media_key === key)
			})

			tweet.author = authors.find(x => x.id === tweet.author_id)

			delete tweet.attachments
			delete tweet.edit_history_tweet_ids

			all_tweets.push(tweet)
		}
	}

	fs.writeFileSync('tweets.json', JSON.stringify(all_tweets, null, 2))

	console.log(`[DL] Downloaded ${all_tweets.length} tweets`)
}

const main = async () => {
	// Load tweets.json
	const tweets = JSON.parse(fs.readFileSync('tweets.json'))

	// Create a new progress bar instance and use shades_classic theme
	const bar = new cliProgress.SingleBar({}, cliProgress.Presets.shades_classic)
	bar.start(tweets.length, 0)

	var i = 0

	// Ingest tweets
	// only get the first 100 tweets
	for (const tweet of tweets) {
		const metadata = {
			...tweet
		}

		delete metadata.text
		delete metadata.edit_history_tweet_ids

		await axios.post(`https://doc-search.sponsus.workers.dev/car-tweets/documents`, { text: tweet.text, metadata })
		// sleep for 50ms
		await new Promise(resolve => setTimeout(resolve, 150))
		i++
		bar.update(i)
	}
	
}

const c = async () => {
	try {
		if (!fs.existsSync('tweets.json')) {
			await download()
		}

		await main()
	} catch (e) {
		console.log(e)
	}
}

c()
