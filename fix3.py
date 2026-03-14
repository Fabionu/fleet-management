with open(r'C:\Users\Home\Desktop\fleet-management-react\src\pages\Tracking.jsx', 'r', encoding='utf-8') as f:
    content = f.read()

changes = 0

# ─────────────────────────────────────────
# 1. SV pause dropdown container: add overflow hidden
# ─────────────────────────────────────────
old1 = (
    "                                boxShadow: '0 4px 16px rgba(0,0,0,0.18)',\n"
    "                                zIndex: 200,\n"
    "                                padding: '10px',\n"
    "                                display: 'flex',\n"
    "                                flexDirection: 'column',\n"
    "                                gap: '6px',\n"
    "                              }}"
)
new1 = (
    "                                boxShadow: '0 4px 16px rgba(0,0,0,0.18)',\n"
    "                                zIndex: 200,\n"
    "                                padding: '10px',\n"
    "                                display: 'flex',\n"
    "                                flexDirection: 'column',\n"
    "                                gap: '6px',\n"
    "                                overflow: 'hidden',\n"
    "                              }}"
)
if old1 in content:
    content = content.replace(old1, new1, 1)
    changes += 1
    print("1. SV pause container overflow: OK")
else:
    print("1. SV pause container overflow: NOT FOUND")

# ─────────────────────────────────────────
# 2. CV pause dropdown container: add overflow hidden
# ─────────────────────────────────────────
old2 = (
    "                                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',\n"
    "                                  zIndex: 200,\n"
    "                                  padding: '10px',\n"
    "                                  display: 'flex',\n"
    "                                  flexDirection: 'column',\n"
    "                                  gap: '6px',\n"
    "                                }}"
)
new2 = (
    "                                  boxShadow: '0 4px 16px rgba(0,0,0,0.18)',\n"
    "                                  zIndex: 200,\n"
    "                                  padding: '10px',\n"
    "                                  display: 'flex',\n"
    "                                  flexDirection: 'column',\n"
    "                                  gap: '6px',\n"
    "                                  overflow: 'hidden',\n"
    "                                }}"
)
if old2 in content:
    content = content.replace(old2, new2, 1)
    changes += 1
    print("2. CV pause container overflow: OK")
else:
    print("2. CV pause container overflow: NOT FOUND")

# ─────────────────────────────────────────
# 3. SV date input: auto-format dd/mm + minWidth + boxSizing
# ─────────────────────────────────────────
old3 = (
    "                                <input\n"
    "                                  type=\"text\"\n"
    "                                  placeholder=\"dd/mm\"\n"
    "                                  maxLength={5}\n"
    "                                  value={pauseFormData.date}\n"
    "                                  onChange={e => setPauseFormData(p => ({ ...p, date: e.target.value }))}\n"
    "                                  style={{ flex: 1, fontSize: '12px', padding: '4px 6px', border: '1px solid var(--gray-2)', borderRadius: '6px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none' }}\n"
    "                                />"
)
new3 = (
    "                                <input\n"
    "                                  type=\"text\"\n"
    "                                  placeholder=\"dd/mm\"\n"
    "                                  maxLength={5}\n"
    "                                  value={pauseFormData.date}\n"
    "                                  onChange={e => {\n"
    "                                    const prev = pauseFormData.date;\n"
    "                                    let val = e.target.value.replace(/[^0-9/]/g, '');\n"
    "                                    if (val.length === 2 && prev.length === 1) val = val + '/';\n"
    "                                    if (val.length > 5) val = val.slice(0, 5);\n"
    "                                    setPauseFormData(p => ({ ...p, date: val }));\n"
    "                                  }}\n"
    "                                  style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', fontSize: '12px', padding: '4px 6px', border: '1px solid var(--gray-2)', borderRadius: '6px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none' }}\n"
    "                                />"
)
if old3 in content:
    content = content.replace(old3, new3, 1)
    changes += 1
    print("3. SV date input auto-format: OK")
else:
    print("3. SV date input auto-format: NOT FOUND")

# ─────────────────────────────────────────
# 4. SV time input: add minWidth + boxSizing
# ─────────────────────────────────────────
old4 = (
    "                                <input\n"
    "                                  type=\"text\"\n"
    "                                  placeholder=\"HH:MM\"\n"
    "                                  maxLength={5}\n"
    "                                  value={pauseFormData.time}\n"
    "                                  onChange={e => setPauseFormData(p => ({ ...p, time: e.target.value }))}\n"
    "                                  style={{ flex: 1, fontSize: '12px', padding: '4px 6px', border: '1px solid var(--gray-2)', borderRadius: '6px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none' }}\n"
    "                                />"
)
new4 = (
    "                                <input\n"
    "                                  type=\"text\"\n"
    "                                  placeholder=\"HH:MM\"\n"
    "                                  maxLength={5}\n"
    "                                  value={pauseFormData.time}\n"
    "                                  onChange={e => setPauseFormData(p => ({ ...p, time: e.target.value }))}\n"
    "                                  style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', fontSize: '12px', padding: '4px 6px', border: '1px solid var(--gray-2)', borderRadius: '6px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none' }}\n"
    "                                />"
)
if old4 in content:
    content = content.replace(old4, new4, 1)
    changes += 1
    print("4. SV time input minWidth: OK")
else:
    print("4. SV time input minWidth: NOT FOUND")

# ─────────────────────────────────────────
# 5. CV date input: auto-format dd/mm + minWidth + boxSizing
# ─────────────────────────────────────────
old5 = (
    "                                  <input\n"
    "                                    type=\"text\"\n"
    "                                    placeholder=\"dd/mm\"\n"
    "                                    maxLength={5}\n"
    "                                    value={pauseFormData.date}\n"
    "                                    onChange={e => setPauseFormData(p => ({ ...p, date: e.target.value }))}\n"
    "                                    style={{ flex: 1, fontSize: '12px', padding: '4px 6px', border: '1px solid var(--gray-2)', borderRadius: '6px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none' }}\n"
    "                                  />"
)
new5 = (
    "                                  <input\n"
    "                                    type=\"text\"\n"
    "                                    placeholder=\"dd/mm\"\n"
    "                                    maxLength={5}\n"
    "                                    value={pauseFormData.date}\n"
    "                                    onChange={e => {\n"
    "                                      const prev = pauseFormData.date;\n"
    "                                      let val = e.target.value.replace(/[^0-9/]/g, '');\n"
    "                                      if (val.length === 2 && prev.length === 1) val = val + '/';\n"
    "                                      if (val.length > 5) val = val.slice(0, 5);\n"
    "                                      setPauseFormData(p => ({ ...p, date: val }));\n"
    "                                    }}\n"
    "                                    style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', fontSize: '12px', padding: '4px 6px', border: '1px solid var(--gray-2)', borderRadius: '6px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none' }}\n"
    "                                  />"
)
if old5 in content:
    content = content.replace(old5, new5, 1)
    changes += 1
    print("5. CV date input auto-format: OK")
else:
    print("5. CV date input auto-format: NOT FOUND")

# ─────────────────────────────────────────
# 6. CV time input: add minWidth + boxSizing
# ─────────────────────────────────────────
old6 = (
    "                                  <input\n"
    "                                    type=\"text\"\n"
    "                                    placeholder=\"HH:MM\"\n"
    "                                    maxLength={5}\n"
    "                                    value={pauseFormData.time}\n"
    "                                    onChange={e => setPauseFormData(p => ({ ...p, time: e.target.value }))}\n"
    "                                    style={{ flex: 1, fontSize: '12px', padding: '4px 6px', border: '1px solid var(--gray-2)', borderRadius: '6px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none' }}\n"
    "                                  />"
)
new6 = (
    "                                  <input\n"
    "                                    type=\"text\"\n"
    "                                    placeholder=\"HH:MM\"\n"
    "                                    maxLength={5}\n"
    "                                    value={pauseFormData.time}\n"
    "                                    onChange={e => setPauseFormData(p => ({ ...p, time: e.target.value }))}\n"
    "                                    style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', fontSize: '12px', padding: '4px 6px', border: '1px solid var(--gray-2)', borderRadius: '6px', background: 'var(--bg-page)', color: 'var(--black)', outline: 'none' }}\n"
    "                                  />"
)
if old6 in content:
    content = content.replace(old6, new6, 1)
    changes += 1
    print("6. CV time input minWidth: OK")
else:
    print("6. CV time input minWidth: NOT FOUND")

# ─────────────────────────────────────────
# 7. SV + CV weekend dropdown: remove minWidth:'180px'
# ─────────────────────────────────────────
count7 = content.count("                minWidth: '180px',\n")
if count7 > 0:
    content = content.replace("                minWidth: '180px',\n", "")
    changes += count7
    print(f"7. Weekend minWidth removed: {count7} OK")
else:
    # try different indentation
    count7b = content.count("minWidth: '180px',\n")
    if count7b > 0:
        # remove all occurrences in weekend dropdowns
        content = content.replace("                minWidth: '180px',\n", "")
        content = content.replace("minWidth: '180px',\n", "")
        changes += count7b
        print(f"7. Weekend minWidth removed (alt): {count7b} OK")
    else:
        print("7. Weekend minWidth: NOT FOUND")

# ─────────────────────────────────────────
# 8. SV weekend dropdown: add overflow hidden
# ─────────────────────────────────────────
old8 = (
    "                                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',\n"
    "                                zIndex: 200,\n"
    "                                padding: '12px',\n"
    "                              }}"
)
new8 = (
    "                                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',\n"
    "                                zIndex: 200,\n"
    "                                padding: '12px',\n"
    "                                overflow: 'hidden',\n"
    "                              }}"
)
if old8 in content:
    content = content.replace(old8, new8, 1)
    changes += 1
    print("8. SV weekend overflow: OK")
else:
    print("8. SV weekend overflow: NOT FOUND")

# ─────────────────────────────────────────
# 9. CV weekend dropdown: add overflow hidden
# ─────────────────────────────────────────
old9 = (
    "                                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',\n"
    "                                  zIndex: 200,\n"
    "                                  padding: '12px',\n"
    "                                }}"
)
new9 = (
    "                                  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',\n"
    "                                  zIndex: 200,\n"
    "                                  padding: '12px',\n"
    "                                  overflow: 'hidden',\n"
    "                                }}"
)
if old9 in content:
    content = content.replace(old9, new9, 1)
    changes += 1
    print("9. CV weekend overflow: OK")
else:
    print("9. CV weekend overflow: NOT FOUND")

with open(r'C:\Users\Home\Desktop\fleet-management-react\src\pages\Tracking.jsx', 'w', encoding='utf-8') as f:
    f.write(content)

print(f"\nTotal changes: {changes}")
