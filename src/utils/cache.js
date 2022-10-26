// BSL Licenced code. See Horseman's licence for more information.
// Created by Cerulean for https://horseman.ceru.dev

export class Cache {
	constructor () {}

	async read(id, callback) {
		const start = Date.now()
		// fires callback if the object is not in the cache, putting the returned value into the cache in its place.
		let cache = caches.default
		const req = new Request(`https://ceru.dev/cache/${id}`)

		let res = await cache.match(req)

		if (!res) {
			console.log(`[CACHE] [${id}] MISS : ${new Date() - start}ms`)

			let value

			try {
				value = await callback()
			} catch (e) {
				return null
			}
			
			res = value

			if (res === null) {
				// Dont cache a null value
				return null
			}

			await this.write(
				id,
				value
			)
		} else {
			console.log(`[CACHE] [${id}] HIT : ${new Date() - start}ms`)
			res = await res.json()
		}

		return res
	}

	async write(id, data, opt) {
		const options = Object.assign(
			{},
			opt
		)

		console.log(`[CACHE] Writing ${id}`)

		let cache = caches.default
		const req = new Request(`https://ceru.dev/cache/${id}`)
		const res = new Response(
			JSON.stringify(data),
			{
				headers: {'Cache-Control': 'max-age=860000'}
			}
		)

		await cache.put(req, res)
	}

	async delete(id) {
		let cache = caches.default
		const req = new Request(`https://ceru.dev/cache/${id}`)

		console.log(`[CACHE] Deleting ${id}`)

		//ctx.waitUntil(async () => {
		await new Promise(r => setTimeout(r, 750))
		await cache.delete(req)

		await this.deleteAll(id)
		console.log(`[CACHE] Deleted ${id}`)
	}

	async deleteAll(id) {
		// requires config to include CF_API_KEY
		// and CLOUDFLARE_ZONE_ID

		const result = await fetch(
			`https://api.cloudflare.com/client/v4/zones/${env.CF_ZONE_ID}/purge_cache`,
			{
				method: 'POST',
				headers: {
					'Authorization': `Bearer ${env.CF_API_TOKEN}`,
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					files: [
						`https://ceru.dev/cache/${id}`
					]
				})
			}
		).then(r=>r.json())
	}
}