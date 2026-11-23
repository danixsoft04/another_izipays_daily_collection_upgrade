IzyPays Daily Collections follow-up fix

Files in this package:
- izypays-parent-fee-fix(1).html (updated master HTML)
- daily-collections-v2.js (updated save, dropdown, and history handling)
- daily-collections.js (matching existing daily collection module)
- daily-collections.css (matching stylesheet)

Upload all four files into the same GitHub Pages folder. Keep the JS and CSS filenames exactly as shown. Rename the HTML file to index.html only if index.html is the filename your live site uses (keep a backup first).

Changes:
1. Fee form submit is bound immediately and in capture phase to prevent accidental page reload/navigation.
2. Fee save checks the returned database row before showing success; database errors are shown in the Daily Collections alert area.
3. Student/class selectors load from the authenticated school's active students without depending on a created_at ordering column. Errors are shown instead of silently leaving empty dropdowns.
4. Daily fee filter dropdowns are populated for both cash reporting and history.
5. History errors are shown in the history table and alert area; history data is read-only and existing records are not deleted.

No Supabase schema, policies, or stored records were changed by preparing this package.
Validation: JavaScript syntax check passed. A live authenticated browser test is still required after upload.
