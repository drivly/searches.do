export const api = {
  icon: '🚀',
  name: 'searches.do',
  description: 'Searches Primitive for Developer-First APIs',
  url: 'https://searches.do/api',
  type: 'https://apis.do/primitives',
  endpoints: {
    listCategories: 'https://templates.do/api',
    getCategory: 'https://templates.do/:type',
  },
  site: 'https://searches.do',
  login: 'https://searches.do/login',
  signup: 'https://searches.do/signup',
  subscribe: 'https://searches.do/subscribe',
  repo: 'https://github.com/drivly/searches.do',
}

export const gettingStarted = [
  `If you don't already have a JSON Viewer Browser Extension, get that first:`,
  `https://extensions.do`,
]

export const examples = {
  listItems: 'https://templates.do/worker',
}

export default {
  fetch: async (req, env) => {
    const { user, hostname, pathname, rootPath, pathSegments, query } = await env.CTX.fetch(req).then(res => res.json())
    if (rootPath) return json({ api, gettingStarted, examples, user })
    
    // TODO: Implement this
    const [ resource, id ] = pathSegments
    const data = { resource, id, hello: user.city }
    
    return json({ api, data, user })
  }
}

const json = obj => new Response(JSON.stringify(obj, null, 2), { headers: { 'content-type': 'application/json; charset=utf-8' }})
