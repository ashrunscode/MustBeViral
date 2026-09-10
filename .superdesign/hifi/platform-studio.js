/* Local design prototype. No API calls, account connections, approval or publication effects. */
const brands = {
  washbodega: {
    name: 'WashBodega',
    workspace: 'WashBodega workspace',
    sector: 'Neighborhood laundry · Houston',
    website: 'https://washbodega.com',
    campaign: 'Laundry on your schedule',
    context: 'Owner material · publication rights review required',
  },
  unpile: {
    name: 'UnPile',
    workspace: 'UnPile workspace',
    sector: 'Laundry pickup & delivery',
    website: 'https://tryunpile.com',
    campaign: 'Make room for your day',
    context: 'Owner website material · publication rights review required',
  },
};
const labels = {
  studio: 'Overview',
  brand: 'Brand draft',
  findings: 'Brand findings',
  assets: 'Asset library',
  campaign: 'Campaign plan',
  review: 'Content review',
  recovery: 'Recovery states',
};
const icon =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>';
let brandId =
  new URLSearchParams(location.search).get('brand') === 'unpile' ? 'unpile' : 'washbodega';
const app = document.querySelector('#app');
const logo = '<img src="platform-assets/washbodega-logo.webp" alt="WashBodega original logo" />';
function photo() {
  return '<img src="platform-assets/washbodega-storefront.webp" alt="WashBodega storefront at dusk" />';
}
function unpilePhoto() {
  return '<img src="platform-assets/unpile-resolved-room.webp" alt="UnPile website hero showing a calm room and folded laundry" />';
}
const unpileWordmark =
  '<span class="unpile-wordmark" aria-label="UnPile original website wordmark">Unpile</span>';
function media(id = brandId) {
  return id === 'washbodega' ? photo() : unpilePhoto();
}
function link(page, text, primary = false) {
  return `<a class="button${primary ? ' primary' : ''}" href="#${page}">${text}</a>`;
}
function header(title, description, action = '') {
  return `<div class="page-heading"><div><h1 tabindex="-1">${title}</h1><p>${description}</p></div>${action}</div>`;
}
function steps(active) {
  return `<nav class="steps" aria-label="Brand setup">${['brand', 'findings', 'assets', 'campaign', 'review'].map((p, i) => `<a class="${p === active ? 'active' : ''}" href="#${p}">${i + 1}. ${labels[p]}</a>`).join('')}</nav>`;
}
function studio() {
  return (
    header(
      'Good work starts with the right brand.',
      'A clear view of what needs attention across your workspaces.',
      link('brand', 'Add a brand', true),
    ) +
    `
    <div class="grid three">
      <div class="card pad stack"><span class="tag attention">Needs a decision</span><h3>Confirm brand findings</h3><p class="quiet">WashBodega’s customer access hours need owner confirmation.</p><a href="#findings">Review findings →</a></div>
      <div class="card pad stack"><span class="tag">Draft ready to review</span><h3>See the creative in context</h3><p class="quiet">Exact logo and original storefront, composed into a sample post.</p><a href="#review">Open review →</a></div>
      <div class="card pad stack"><span class="tag attention">Connection needed</span><h3>No publishing accounts yet</h3><p class="quiet">Keep creating. Scheduling starts after account and permission checks.</p><a href="#recovery">See connection recovery →</a></div>
    </div>
    <div class="section-heading"><h2>Your brands</h2><span class="mono">2 sample workspaces</span></div>
    <div class="grid">${Object.entries(brands)
      .map(
        ([id, b]) =>
          `<article class="card"><div class="media">${media(id)}${id === 'washbodega' ? logo.replace('<img ', '<img class="brand-logo" ') : `<div class="unpile-brand-logo">${unpileWordmark}</div>`}</div><div class="brand-body"><div class="row between"><h2>${b.name}</h2><span class="tag">Owner material</span></div><p>${b.sector}</p><div class="row between"><small>${b.workspace}</small><button data-brand="${id}">Open brand →</button></div></div></article>`,
      )
      .join('')}</div>
    <div class="section-heading"><h2>A useful next step</h2></div><div class="card pad row between"><div><h3>Build one campaign from approved brand material</h3><p class="quiet">Findings → source assets → channel preview → review.</p></div>${link('campaign', 'Open campaign plan')}</div>`
  );
}
function draft(b) {
  return (
    header(
      `Make ${b.name} feel like itself.`,
      'Start with your website and original material. Save a draft before you have every answer.',
    ) +
    steps('brand') +
    `<div class="split"><section class="card pad stack"><div class="row between"><h2>Brand essentials</h2><span class="tag">Draft · design preview</span></div><form class="field-grid" id="brand-form"><label>Brand name<input name="brand-name" value="${b.name}" required maxlength="100" /></label><label>Website<input name="website" value="${b.website}" type="url" required /></label><label>What should we know?<textarea placeholder="Customers, locations, offers, and the things that make this brand different.">${brandId === 'washbodega' ? 'Customer access is 24/7. Do not imply the counter, phone, or wash & fold service is staffed 24/7.' : 'Laundry pickup and delivery. Confirm address eligibility, pickup windows, prices and offers before making campaign claims.'}</textarea></label><div class="note">Your original media stays private. Website findings need review before they become brand guidance.</div><button class="primary" type="submit">Save draft & review findings</button></form></section><aside class="card"><div class="media">${media()}</div><div class="pad stack"><h2>A brand you can reuse</h2><p>Build knowledge once, correct it with sources, and carry the approved version into every campaign.</p><div class="list"><p>01 · Website and document findings</p><p>02 · Identity, original assets and rights</p><p>03 · Offers, voice and locations</p></div><small>${b.context}</small></div></aside></div>`
  );
}
function findings(b) {
  return (
    header(
      'Review the source. Keep the meaning.',
      `${b.name} / ${b.workspace}. These sample findings are not a completed website analysis.`,
      link('assets', 'Continue to assets', true),
    ) +
    steps('findings') +
    `<div class="split"><section class="card"><div class="finding"><div class="row between"><h2>What the brand does</h2><span class="tag">Owner input</span></div><p>${brandId === 'washbodega' ? 'A neighborhood laundry in Houston, with 24-hour customer access.' : 'Laundry pickup and delivery, with its own brand, website and workspace.'}</p><span class="source">Source: ${brandId === 'washbodega' ? 'owner operating guidance, 2026-09-05' : 'owner website repository, read 2026-09-09'}</span></div><div class="finding"><div class="row between"><h3>${brandId === 'washbodega' ? 'Separate access hours from service hours' : 'Confirm coverage and pickup windows'}</h3><span class="tag attention">Needs confirmation</span></div><p>${brandId === 'washbodega' ? '24/7 describes customer access. Staffed counter and wash & fold hours are not confirmed here.' : 'Service-area eligibility and pickup windows are not verified in this preview. Do not copy another brand’s operating hours.'}</p><label>Owner correction<textarea placeholder="Add the correct detail and its source."></textarea></label></div><div class="finding"><h3>Offers and pricing</h3><p>No offer or price has been approved. Campaigns can use a non-price concept while details are reviewed.</p><span class="tag">Not supplied</span></div></section><aside class="stack"><div class="card pad stack"><h2>Proposed brand version</h2><p>Draft 01. Changes remain editable until an owner approves the version.</p><label class="check"><input type="checkbox" id="findings-confirm" /> I have reviewed the sample source notes</label><button data-action="approve-findings">Preview approval outcome</button><small>This previews the interaction only. No brand version is approved.</small></div><div class="note">Changing a fact later creates a new version. Existing creative keeps its original source version and must be reviewed again if affected.</div></aside></div>`
  );
}
function assets(b) {
  return (
    header(
      'Start with the originals.',
      `${b.name} / ${b.workspace}. Keep identity, rights and source history attached to every asset.`,
      '<button class="primary" data-action="upload">Add an asset</button>',
    ) +
    steps('assets') +
    `<div class="row" style="margin-bottom:20px"><span class="tag">All assets</span><span class="tag">Originals</span><span class="tag">Rights need review</span></div><div class="grid"><article class="card"><div class="media">${media()}</div><div class="pad stack"><h2>${brandId === 'washbodega' ? 'Storefront at dusk' : 'A calmer room · website hero'}</h2><p>${b.context}</p><span class="tag attention">Review rights before publishing</span><small>${brandId === 'washbodega' ? 'Exact file from the owner’s website repository. No generative edits.' : 'Exact existing website hero file. Its original production method and publication rights still require review.'}</small>${link('campaign', 'Use in a campaign')}</div></article><article class="card">${brandId === 'washbodega' ? logo.replace('<img ', '<img class="asset-logo" ') : `<div class="asset-logo unpile-identity">${unpileWordmark}</div>`}<div class="pad stack"><h2>${brandId === 'washbodega' ? 'Original brand logo' : 'Original website wordmark'}</h2><p>Place the original identity directly into the composition. Keep it separate from generated backgrounds.</p><span class="tag">Original source retained</span><small>Changes to identity require a new approved brand version.</small></div></article></div><div class="section-heading"><h2>Still needed</h2></div><div class="placeholder"><h3>Give the next campaign a human point of view</h3><p>Request a short, permissioned clip of the service or product in use.</p><button data-action="capture">Preview a capture request</button></div>`
  );
}
function campaign(b) {
  return (
    header(
      b.campaign,
      `${b.name} / ${b.workspace} · Campaign draft. No accounts connected or posts scheduled.`,
      link('review', 'Review creative', true),
    ) +
    `<div class="card pad row between"><div><span class="mono">Objective</span><h3>${brandId === 'washbodega' ? 'Help neighbors recognize the store and plan their visit.' : 'Introduce laundry pickup and delivery without inventing prices or coverage.'}</h3></div><span class="tag">Source version · draft 01</span></div><div class="section-heading"><h2>Content plan</h2><span class="quiet">Board view · sample work</span></div><div class="board"><section class="column"><h2>Ideas</h2><article class="card pad stack"><span class="tag">Capture needed</span><h3>A moment behind the scenes</h3><p class="quiet">Show the real service or product. Obtain permission from anyone identifiable.</p><button data-action="capture">Plan a capture</button></article></section><section class="column"><h2>Drafts</h2><article class="card"><div class="media">${media()}</div><div class="pad stack"><h3>${b.campaign}</h3><p class="quiet">Facebook / Instagram · static concept</p><span class="tag attention">Rights & facts review</span>${link('review', 'Open draft')}</div></article></section><section class="column"><h2>Ready to schedule</h2><div class="placeholder"><h3>No approved posts yet</h3><p class="quiet">Review the exact content, then choose a connected account and a time.</p><span class="tag">Nothing scheduled</span></div></section></div>`
  );
}
function review(b) {
  return (
    header(
      'See exactly what you are approving.',
      `${b.name} / ${b.workspace} · ${b.campaign}`,
      '<span class="tag attention">Draft · rights review required</span>',
    ) +
    `<div class="split"><section class="card pad stack"><div class="row between"><h2>Channel preview</h2><span class="tag">Instagram · Feed 4:5</span></div><article class="ad"><div class="ad-head row">${brandId === 'washbodega' ? logo : unpileWordmark}<div>${b.name}<div class="quiet">Design preview</div></div></div><div class="creative ${brandId === 'unpile' ? 'unpile-creative' : ''}">${brandId === 'washbodega' ? photo().replace('<img ', '<img class="photo" ') : unpilePhoto().replace('<img ', '<img class="photo" ')}<div class="creative-copy">${brandId === 'washbodega' ? logo : unpileWordmark}<h2>${brandId === 'washbodega' ? 'Laundry on your schedule.' : 'Make room for your day.'}</h2><p>${brandId === 'washbodega' ? 'Your neighborhood laundry. Customer access 24/7.' : 'Laundry pickup & delivery. A little more room for life.'}</p></div></div><div class="ad-footer"><div><small>${b.website.replace('https://', '')}</small><p>${brandId === 'washbodega' ? 'Plan your next visit' : 'Explore pickup & delivery'}</p></div><span class="tag">Learn more</span></div></article><small>Exact logo and typography are composed as separate layers. This is a local HTML proof, not a rendered publication file.</small></section><aside class="stack"><section class="card pad stack"><h2>Review checks</h2><div class="list"><div class="row between"><span>Original media retained</span><span class="tag good">Checked locally</span></div><div class="row between"><span>Brand facts</span><span class="tag attention">Owner review</span></div><div class="row between"><span>Publication rights</span><span class="tag attention">Not confirmed</span></div><div class="row between"><span>Publishing account</span><span class="tag">Not connected</span></div></div><label>Request a change<textarea placeholder="Tell the creator exactly what to adjust."></textarea></label><button class="primary" data-action="change">Preview change request</button><button disabled>Approve & schedule</button><small>Approval is unavailable until facts, rights and the exact destination are checked.</small></section><section class="card pad stack"><h3>Originals remain attached</h3><p class="quiet">Brand draft 01 → original asset → composition draft 01. A changed price, image or caption invalidates the prior approval.</p>${link('assets', 'Inspect source assets')}</section></aside></div>`
  );
}
function recovery(b) {
  return (
    header(
      'Keep your work. Resolve the exception.',
      `${b.name} / ${b.workspace}. Named recovery states for design review.`,
    ) +
    `<div class="grid"><section class="card pad stack"><span class="tag">Loading</span><h2>Reading your brand sources</h2><div class="skeleton"></div><div class="skeleton"></div><p>Saved drafts remain available while sources are checked. No invented completion percentage.</p>${link('brand', 'Return to saved draft')}</section><section class="card pad stack"><span class="tag attention">Connection expired</span><h2>Reconnect before scheduling</h2><p>The draft stays intact. Scheduling pauses until account permissions are verified.</p><button data-action="connect">Preview reconnect flow</button></section><section class="card pad stack"><span class="tag attention">Upload interrupted</span><h2>Your other assets are safe</h2><p>Resume the selected upload. An incomplete file cannot be used in an approved post.</p><button data-action="upload">Resume upload preview</button></section><section class="card pad stack"><span class="tag">Billing unavailable</span><h2>Balance could not be loaded</h2><p>We cannot show a current balance. Spend actions pause while the account is checked.</p><button data-action="billing">Retry balance preview</button></section><section class="card pad stack"><span class="tag attention">Approval out of date</span><h2>The caption changed after approval</h2><p>Publishing is paused. Review the current version and the change before approving again.</p>${link('review', 'Review changed draft')}</section><section class="card pad stack"><span class="tag attention">Access changed</span><h2>This workspace is no longer available</h2><p>The revoked workspace disappears from your portfolio. Choose another permitted brand to continue.</p><button data-brand="${brandId === 'washbodega' ? 'unpile' : 'washbodega'}">Choose another sample brand</button></section></div>`
  );
}
function render() {
  const page = Object.hasOwn(labels, location.hash.slice(1)) ? location.hash.slice(1) : 'studio';
  const b = brands[brandId];
  app.innerHTML = `<aside class="rail"><div class="wordmark">MustBeViral<span style="color:var(--signal)">.</span></div><div class="studio-name"><small>STUDIO</small><div>My creative studio</div></div><nav class="nav" aria-label="Design walkthrough">${Object.entries(
    labels,
  )
    .map(
      ([key, label]) =>
        `<a href="#${key}" ${page === key ? 'aria-current="page"' : ''}>${icon}${label}</a>`,
    )
    .join(
      '',
    )}</nav><div class="rail-foot">Every brand has a home.<br />Every decision has a source.</div></aside><div class="shell"><header class="topbar"><div class="breadcrumb"><span>My studio</span><span>/</span><span>${page === 'studio' ? 'Overview' : b.name}</span></div><div class="context"><label for="brand-switch" class="quiet">Active brand</label><select id="brand-switch"><option value="washbodega" ${brandId === 'washbodega' ? 'selected' : ''}>WashBodega</option><option value="unpile" ${brandId === 'unpile' ? 'selected' : ''}>UnPile</option></select><span class="avatar" aria-label="Sample owner">SC</span></div></header><div class="preview-banner">Design preview · Sample work only. No connected accounts, saved production data, approvals or publication.</div><main id="main">${{ studio, brand: draft, findings, assets, campaign, review, recovery }[page](b)}</main></div><div class="toast" role="status" aria-live="polite"></div>`;
  document
    .querySelector('#brand-switch')
    .addEventListener('change', (event) => changeBrand(event.target.value));
  document
    .querySelectorAll('[data-brand]')
    .forEach((el) => el.addEventListener('click', () => changeBrand(el.dataset.brand)));
  document.querySelectorAll('[data-action]').forEach((el) =>
    el.addEventListener('click', () => {
      const messages = {
        upload: 'Upload recovery preview. No file was uploaded.',
        capture: 'Capture request preview. No request was sent.',
        connect: 'Connection preview. No OAuth flow started.',
        billing: 'Balance remains unavailable in this preview.',
        change: 'Change request preview. No notification was sent.',
        'approve-findings': document.querySelector('#findings-confirm')?.checked
          ? 'Approval outcome previewed. No brand version was approved.'
          : 'Review the sample source notes first.',
      };
      document.querySelector('.toast').textContent = messages[el.dataset.action];
    }),
  );
  document.querySelector('#brand-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    location.hash = 'findings';
  });
}
function changeBrand(id) {
  brandId = Object.hasOwn(brands, id) ? id : 'washbodega';
  const url = new URL(location.href);
  url.searchParams.set('brand', brandId);
  url.hash = 'brand';
  history.replaceState(null, '', url);
  render();
  document.querySelector('h1').focus();
}
window.addEventListener('hashchange', () => {
  render();
  document.querySelector('h1').focus();
});
render();
