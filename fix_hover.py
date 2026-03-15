with open(r'C:\Users\Home\Desktop\fleet-management-react\src\pages\Tracking.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# ─── 1. SV <tr>: direct DOM hover pe element, fără state ───────────────────
old = (
    "                  <tr key={truck.id}\n"
    "                    style={{ borderBottom: isNotLast ? '1px solid var(--gray-2)' : 'none' }}\n"
    "                    onMouseEnter={() => setRowHoverId(truck.id)}\n"
    "                    onMouseLeave={() => setRowHoverId(null)}\n"
    "                  >"
)
new = (
    "                  <tr key={truck.id}\n"
    "                    style={{ borderBottom: isNotLast ? '1px solid var(--gray-2)' : 'none', background: 'var(--surface)', transition: 'background 0.15s' }}\n"
    "                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--gray-1)'; }}\n"
    "                    onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; }}\n"
    "                  >"
)
if old in content:
    content = content.replace(old, new, 1)
    changes += 1
    print("1. SV <tr> hover direct DOM: OK")
else:
    print("1. SV <tr>: NOT FOUND")

# ─── 2-7. SV TDs: înlocuiește background JS cu transparent ─────────────────
# Toate cele 6 TD-uri din SV au unul din cele 3 pattern-uri de mai jos

td_patterns = [
    # Vehicul TD
    (
        "background: rowHoverId === truck.id ? 'var(--gray-1)' : 'var(--surface)', transition: 'background 0.15s' }}>",
        "background: 'transparent' }}>"
    ),
    # Repaus TD (are și alte proprietăți după)
    (
        "background: rowHoverId === truck.id ? 'var(--gray-1)' : 'var(--surface)', transition: 'background 0.15s', position: 'relative',",
        "background: 'transparent', position: 'relative',"
    ),
    # Client TD
    (
        "background: rowHoverId === truck.id ? 'var(--gray-1)' : 'var(--surface)', transition: 'background 0.15s' }}>",
        "background: 'transparent' }}>"
    ),
]

# Pattern comun pentru Incărcare, Descărcare, Observații TDs
common_old = "background: rowHoverId === truck.id ? 'var(--gray-1)' : 'var(--surface)', transition: 'background 0.15s'"
common_new = "background: 'transparent'"

count = content.count(common_old)
if count > 0:
    content = content.replace(common_old, common_new)
    changes += count
    print(f"2-7. SV TDs background transparent: {count} OK")
else:
    print("2-7. SV TDs: NOT FOUND")

# ─── 8. Preview button: mai vizibil (border + culoare mai intensă) ──────────
# SV version
old_btn_sv = (
    "                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', color: 'var(--gray-3)', display: 'flex', alignItems: 'center', flexShrink: 0, borderRadius: '5px', transition: 'color 0.15s', marginTop: '1px' }}\n"
    "                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--blue)'; e.currentTarget.style.background = 'var(--gray-1)'; }}\n"
    "                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--gray-3)'; e.currentTarget.style.background = 'none'; }}"
)
new_btn_sv = (
    "                            style={{ background: 'transparent', border: '1px solid var(--gray-2)', cursor: 'pointer', padding: '3px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', flexShrink: 0, borderRadius: '5px', transition: 'all 0.15s', marginTop: '1px' }}\n"
    "                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--blue)'; e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}\n"
    "                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}"
)
if old_btn_sv in content:
    content = content.replace(old_btn_sv, new_btn_sv, 1)
    changes += 1
    print("8. SV preview button vizibil: OK")
else:
    print("8. SV preview button: NOT FOUND")

# CV version
old_btn_cv = (
    "                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 3px', color: 'var(--gray-3)', display: 'flex', alignItems: 'center', flexShrink: 0, borderRadius: '5px', transition: 'color 0.15s', marginTop: '1px' }}\n"
    "                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--blue)'; e.currentTarget.style.background = 'var(--gray-1)'; }}\n"
    "                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--gray-3)'; e.currentTarget.style.background = 'none'; }}"
)
new_btn_cv = (
    "                            style={{ background: 'transparent', border: '1px solid var(--gray-2)', cursor: 'pointer', padding: '3px 5px', color: 'var(--gray-4)', display: 'flex', alignItems: 'center', flexShrink: 0, borderRadius: '5px', transition: 'all 0.15s', marginTop: '1px' }}\n"
    "                            onMouseEnter={e => { e.currentTarget.style.color = 'var(--blue)'; e.currentTarget.style.background = 'var(--gray-1)'; e.currentTarget.style.borderColor = 'var(--blue)'; }}\n"
    "                            onMouseLeave={e => { e.currentTarget.style.color = 'var(--gray-4)'; e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'var(--gray-2)'; }}"
)
if old_btn_cv in content:
    content = content.replace(old_btn_cv, new_btn_cv, 1)
    changes += 1
    print("9. CV preview button vizibil: OK")
else:
    print("9. CV preview button: NOT FOUND")

with open(r'C:\Users\Home\Desktop\fleet-management-react\src\pages\Tracking.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal changes: {changes}")
