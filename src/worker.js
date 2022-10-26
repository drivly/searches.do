import { response } from 'cfw-easy-utils'
import { Router } from 'itty-router'
import { createCors } from 'itty-cors'
import Snowball from 'snowball'
import yaml from 'js-yaml'
import { Cache } from './utils/cache.js'
import ExploreHTML from './ui/index.html'

import { openapi_spec } from './spec.js'

const { preflight, corsify } = createCors({
	methods: ['GET', 'POST', 'OPTIONS', 'DELETE'],
	maxAge: 86400,
})

// Tokenizer setup
const stemmer = new Snowball('English')

const tokenize_phrase = (phrase) => {
	const tokens = []

	// Lets be real, these words are useless when it comes to
	// searching for documents.
	// They only add noise to the search results and increase the index size.
	const blocked_tokens = [
		'the',
		'and',
		'or',
		'a',
		'an',
		'of',
		'for',
	]

	phrase.toLowerCase().split(' ').filter(x => x.length > 0).forEach((word) => {
		stemmer.setCurrent(word)
		stemmer.stem()
		tokens.push(stemmer.getCurrent())
	})

	return tokens
}


// Named nanoid generator, used to create document IDs that
// mean something for support down the road.
const nanoid = (t, size = 21) => {
	const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
	let id = ''
	for (let i = 0; i < size; i++) {
		id += ALPHABET[Math.floor(Math.random() * ALPHABET.length)]
	}
	return `${t}_${id}`
}

export let api = {
	icon: '📃',
	name: 'search.do',
	description: 'Text search API built on Cloudflare Workers.',
	url: 'https://search.do/api',
	type: 'https://apis.do/subscriptions',
	endpoints: 'https://${hostname}/api/spec.yaml',
	site: 'https://search.do',
	login: 'https://search.do/login',
	signup: 'https://search.do/signup',
	repo: 'https://github.com/drivly/search.do',
}

export default {
	fetch: async (req, env) => {
		// Process api and replace all values with ${hostname} with the actual hostname
		api = JSON.parse(JSON.stringify(api).replace(/\$\{hostname\}/g, new URL(req.url).hostname))

		const router = Router()

		// CORS preflight setup
		router.all('*', preflight)

		router.get('/api', () => response.json({api}))

		router.get('/api/explore', () => new Response(ExploreHTML, { headers: { 'Content-Type': 'text/html' } }))

		// Used to expand some API requests such as the search endpoint,
		// for including data in the count.
		const includes = (new URL(req.url).searchParams.get('includes') || '').split(',')

		// A test endpoint for the tokenizer
		router.get('/tokenize', async (req) => {
			const { text } = req.query
			return response.json({text, output: tokenize_phrase(text)})
		})

		router.get('/api', () => response.json({api}))
		
		// Returns our OpenAPI spec for viewing in something like the Swagger UI.
		router.get('/api/spec.:format', (req) => {
			const formatter = {
				json: JSON.stringify,
				yaml: yaml.dump,
			}[req.params.format.toLowerCase()]

			if (!formatter) {
				return response.json({success: false, error: 'Invalid format provided, please pick either JSON or YAML'}, {status: 400})
			}

			return new Response(formatter(openapi_spec), {headers: {'Content-Type': `application/${req.params.format}`}})
		})

		// Searches the database for the query `q`. Returns a list of documents limited to `limit`.
		router.get('/:databaseID/search', async (req) => {
			api.includes = [
				'count: returns the document count in the database. (GET /:databaseID/documents?includes=count)',
			]

			const { databaseID } = req.params

			const durable = env.TextSearchDO.get(env.TextSearchDO.idFromName(databaseID))

			const { documents } = await durable.fetch(
				`https://textsearch.do/v1/search?q=${req.query.q || ''}&limit=${ req.query.limit || 25 }`
			).then(res => res.json())

			let count = `unknown`

			if (includes.includes('count')) {
				const r = await durable.fetch(
					`https://textsearch.do/v1/count`
				).then(res => res.json())
				count = r.count
			}

			return response.json({
				api,
				count,
				results_length: documents.length,
				results: documents,
			})
		})
		
		// Counts the number of documents in the database
		router.get('/:databaseID/count', async (req) => {
			const { databaseID } = req.params

			const durable = env.TextSearchDO.get(env.TextSearchDO.idFromName(databaseID))

			const { count } = await durable.fetch(
				`https://textsearch.do/v1/count`
			).then(res => res.json())

			return response.json({
				api,
				count
			})
		})

		// Create a new document for this database to store.
		router.post('/:databaseID/documents', async (req) => {
			const { databaseID } = req.params
			const data = await req.json()

			// data should follow this format:
			// {
			// 	"text": "this is the text to be indexed",
			// 	"metadata": { "URL": "https://wikipedia.com/" }
			// }

			// basic validation to ensure data is valid, without overloading the engine.
			if (!data.text) {
				return response.json({success: false, error: 'No text provided in the `text` field.', code: 'NO_TEXT'}, { status: 400 })
			}
			
			if (!data.metadata) {
				// if no metadata is provided, we'll just put a placeholder there.
				data.metadata = {}
			}
			
			if (JSON.stringify(data.metadata).length > 2000) {
				return response.json({success: false, error: 'Metadata is too large. Metadata must be less than 2KB.', code: 'METADATA_TOO_LARGE'}, { status: 400 })
			}

			const durable = env.TextSearchDO.get(env.TextSearchDO.idFromName(databaseID))

			const { document } = await durable.fetch(
				`https://textsearch.do/v1/ingest`,
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(data)
				}
			).then(res => res.json())

			return response.json({
				api,
				document
			})
		})

		// Wipes a database of all documents. This is a destructive operation, obviously.
		router.delete('/:databaseID/documents', async (req) => {
			const { databaseID } = req.params

			const durable = env.TextSearchDO.get(env.TextSearchDO.idFromName(databaseID))

			const { success, total_removed } = await durable.fetch(
				`https://textsearch.do/v1/delete`,
				{ method: 'DELETE' }
			).then(res => res.json())

			return response.json({
				api,
				success,
				total_removed
			})
		})

		router.delete('/:databaseID/documents/:documentID', async (req) => {
			const { databaseID, documentID } = req.params

			const durable = env.TextSearchDO.get(env.TextSearchDO.idFromName(databaseID))

			const { success, error } = await durable.fetch(
				`https://textsearch.do/v1/delete/${documentID}`,
				{ method: 'DELETE' }
			).then(res => res.json())

			return response.json({
				api,
				success,
			})
		})

		router.all('*', () => response.json({success: false, error: 'Invalid endpoint.'}, {status: 404}))

		return await router.handle(req).then(corsify)
	}
}

export class TextSearchDO {
	constructor(state, env) {
		this.state = state
		this.env = env
	}

	async fetch(req) {
		const router = Router()

		const cache = new Cache()

		// INTERNAL DURABLE OBJECT API. ONLY TO BE USED WITH THE SEARCH.DO GATEWAY.

		// Count documents stored in this database.
		router.get('/v1/count', async (req) => {
			let cursorID = null
			let complete = false
			let total = 0

			while (!complete) {
				const { keys, list_complete, cursor } = await this.env.DOCUMENT_STORE.list({
					prefix: `doc:${this.state.id.toString()}`,
					'cursor': cursorID,
					limit: 1000
				})

				complete = list_complete
				cursorID = cursor

				total += keys.length
			}

			return response.json({
				success: true,
				count: total
			})
		})

		router.get('/v1/search', async (req) => {
			// our indexes are stored as a set of keys and values.
			// the keys are the tokenized words, and the values are the documentIDs that contain that word.
			// we can use this to quickly find documents that contain the words we're searching for by intersecting the sets.
			let { q, limit } = req.query

			limit = parseInt(limit || '25')

			const tokens = tokenize_phrase(q)

			// We should be careful here.
			// If we paginate the data, the documents will not be sorted in order of relevance.
			// This is due to the fact that if we load more and more documents,
			// older documents will be pushed out of results, even though they might be more relevent.

			// For now, if we just grab a lot of indexes, it should be fine for a smaller database.
			// but once we store more than a few thousand, we'll need a different solution.
			const results = await Promise.all(tokens.map(async (token) => {
				const search = {
					prefix: `idx: ${token}`,
					reverse: true,
					limit: 400
				}

				const d = await this.state.storage.list(search).then(list => Object.fromEntries(list))
				return d
			}))

			// After trying a pure intersection, I found that the results were too strict.
			// Pushing out relevent documents because they didn't contain every word.
			// So, I'm going back to the old way of just combining the results and sorting them by relevance.

			const all_documents = results.map(arr => {
				return Object.values(arr)
			})

			// Intersect the results.
			// const documentIDs = new Set(all_documents.reduce((acc, curr) => {
			// 	return acc.filter(x => curr.includes(x))
			// }))

			// Just flatten the all documents array :(
			const documentIDs = new Set(all_documents.flat())

			// Finally, we can turn the documentIDs into the actual documents.
			let documents = await Promise.all(Array.from(documentIDs).map(async (documentID) => {
				// cache.read will try to find the key in cache, and if it doesnt exist, it will run the callback.
				// storing the document in the cache key used to read.

				// This is required because if a user searches an extremely common word, like "the",
				// it will return every document in the database. Its insane but we need to at least lower the cost somehow.
				const doc = await cache.read(`doc:${this.state.id.toString()} ${documentID}`, async () => {
					return await this.env.DOCUMENT_STORE.get(`doc:${this.state.id.toString()} ${documentID}`).then(JSON.parse)
				})

				if (!doc) {
					// :(
					console.log(`Document ${documentID} not found!!!!!!!`)
					return null
				}

				// Relevance is calculated by the number of tokens that match the document.
				// Using the token array in the document.
				doc.relevance = doc.tokens.filter(token => tokens.includes(token)).length
				
				delete doc.tokens // no need to show this to the user.
				doc.preview_text = doc.text.slice(0, 400) // preview text is the first 100 characters of the document.
				delete doc.text
				return doc
			}))

			// sort by relevance
			documents = documents.filter(x => x).sort((a, b) => b.relevance - a.relevance)

			// Limit the results by the `limit` query parameter.
			documents = documents.slice(0, limit)

			return response.json({
				tokens,
				documents,
			})
		})

		router.delete('/v1/delete', async (req) => {
			// Delete all documents in this database, including those from the KV.
			let cursorID = null
			let complete = false
			let total_removed = 0

			while (!complete) {
				const { keys, list_complete, cursor } = await this.env.DOCUMENT_STORE.list({
					prefix: `doc:${this.state.id.toString()}`,
					'cursor': cursorID,
					limit: 1000
				})

				complete = list_complete
				cursorID = cursor

				total_removed += keys.length

				await Promise.all(keys.map(async (key) => {
					await this.env.DOCUMENT_STORE.delete(key.name)
				}))
			}
				
			const { success } = await this.state.storage.deleteAll().then(() => ({ success: true }))
			return response.json({ success, total_removed })
		})

		router.post('/v1/ingest', async (req) => {
			const data = await req.json()

			const document = {
				id: nanoid('doc'),
				text: data.text,
				metadata: data.metadata,
				tokens: tokenize_phrase(data.text) // used to intersect with other documents later.
			}

			// Tokenize the document
			const tokens = tokenize_phrase(document.text)

			// Store the document in KV since DOs storage is too small :(
			// This KV is going to store all documents from all databases across all instances of this API.
			// Therefore we need a database level store that can used to delete all documents from this database.
			await this.env.DOCUMENT_STORE.put(`doc:${this.state.id.toString()} ${document.id}`, JSON.stringify(document))

			const total_writes = tokens.length

			// Store the documentID in the index for each token
			await Promise.all(tokens.map(async (token) => {
				await this.state.storage.put(`idx: ${token} -> ${document.id}`, document.id)
			}))

			return response.json({ success: true, document, total_writes })
		})

		return await router.handle(req)
  	}
}