# Tableau Public Data App (interim pattern)

A React app on GitHub Pages that **contains no data**. It embeds a Tableau Public viz (Embedding API v3), reads the
viz's summary data, draws custom UI, and pushes clicks back as Tableau filters.

Why: Tableau Public can't host Data Apps yet and only runs Tableau Trusted extensions, so a remote extension won't load there.
This pattern needs no credentials and no backend, and everything in the viz is public.

## Two ways to use it
1. **Standalone page** on GitHub Pages: `https://<you>.github.io/<repo>/?viz=<public viz url>&sheet=<worksheet>&dim=<field>`
2. **As a Web Page object** inside a Public dashboard (Desktop Public Edition). Add a *Go to URL* action targeting that object:
   `https://<you>.github.io/<repo>/?viz=<...>&sheet=<...>&select=<Region>` so a mark click in Tableau pushes the selection in.
   (Tableau -> app is one-way here. The app can't change the dashboard around it.)

## Params
`viz` Public viz URL (the data source) · `sheet` worksheet to read · `dim` card dimension (default: first text column) ·
`select` preselected value · `metric` measure name · `show=1` reveal the embedded viz

## Limits
Reads worksheet summary data only. Data is public. The app lives on github.io, not public.tableau.com.
The Embedding API lazy-loads off-screen vizzes, so the hidden viz is kept inside the viewport at opacity 0.

`src/tableau.ts` is the only Tableau-aware file, so it can be swapped for the Extensions API later.

    npm install && npm run dev      # local
    npm run build                   # dist/ for Pages
