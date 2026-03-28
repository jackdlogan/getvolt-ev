// Runs in MAIN world (page context) at document_start
// Patches fetch to intercept Volt GraphQL responses and paginate tier products

const GRAPHQL_URL = 'volt-graphql.skymavis.com/graphql';

// GraphQL query to fetch all products for a single tier
const TIER_PRODUCTS_QUERY = `
  query TierProducts($packAddress: String!, $tierId: Int!, $after: String) {
    collectibleMarketFunPack(packAddress: $packAddress) {
      tiers(tierId: $tierId) {
        tierId
        products(first: 100, after: $after) {
          nodes {
            price
            availableQuantity
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    }
  }
`;

async function fetchAllTierNodes(graphqlUrl, headers, packAddress, tierId, initialNodes, endCursor) {
  const allNodes = [...initialNodes];
  let cursor = endCursor;

  while (cursor) {
    try {
      const res = await window._originalFetch(graphqlUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          query: TIER_PRODUCTS_QUERY,
          variables: { packAddress, tierId, after: cursor },
        }),
      });
      const json = await res.json();
      const tiers = json?.data?.collectibleMarketFunPack?.tiers;
      const tierData = Array.isArray(tiers)
        ? tiers.find((t) => t.tierId === tierId)
        : tiers;

      if (!tierData) break;

      const nodes = tierData.products?.nodes ?? [];
      allNodes.push(...nodes);

      const pageInfo = tierData.products?.pageInfo;
      cursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
    } catch (_) {
      break;
    }
  }

  return allNodes;
}

const originalFetch = window.fetch;
window._originalFetch = originalFetch; // keep unpatched reference

window.fetch = async function (...args) {
  const response = await originalFetch.apply(this, args);

  try {
    const url = typeof args[0] === 'string' ? args[0] : args[0]?.url ?? '';
    if (!url.includes(GRAPHQL_URL)) return response;

    const clone = response.clone();
    clone.json().then(async (body) => {
      const pack = body?.data?.collectibleMarketFunPack;
      if (!pack || !Array.isArray(pack.tiers) || pack.tiers.length === 0) return;

      // Capture original request headers for reuse
      const init = args[1] ?? {};
      const headers = init.headers ?? {};

      // Resolve all tiers — paginate those with more pages
      const resolvedTiers = await Promise.all(
        pack.tiers.map(async (t) => {
          const initialNodes = t.products?.nodes ?? [];
          const pageInfo = t.products?.pageInfo;

          const allNodes = pageInfo?.hasNextPage
            ? await fetchAllTierNodes(
                url,
                headers,
                pack.packAddress,
                t.tierId,
                initialNodes,
                pageInfo.endCursor,
              )
            : initialNodes;

          return {
            tierId: t.tierId,
            name: t.metadata?.name ?? `Tier ${t.tierId}`,
            color: t.metadata?.tierMainColor ?? 'gray',
            tierPrice: t.price,
            ratio: t.ratio,
            nodes: allNodes,
            totalAvailable: t.products?.totalAvailable ?? allNodes.length,
          };
        }),
      );

      window.dispatchEvent(
        new CustomEvent('VoltEVData', {
          detail: {
            packName: pack.metadata?.name ?? 'Pack',
            unitPrice: pack.unitPrice,
            tiers: resolvedTiers,
          },
        }),
      );
    }).catch(() => {});
  } catch (_) {}

  return response;
};
