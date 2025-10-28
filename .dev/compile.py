from pathlib import Path
import zipfile

script_dir = Path(__file__).resolve().parent
enquote_dir = script_dir.parent

# compile for Chrome
with zipfile.ZipFile(script_dir / "enquote.zip", "w", zipfile.ZIP_DEFLATED) as archive:
	for path in enquote_dir.iterdir():
		if not path.name.startswith(".") and path.name != "manifest-firefox.json":
			archive.write(path, arcname = path.name)

# compile for Firefox
with zipfile.ZipFile(script_dir / "enquote-firefox.zip", "w", zipfile.ZIP_DEFLATED) as archive:
	for path in enquote_dir.iterdir():
		if path.name == "manifest-firefox.json":
			archive.write(path, arcname = "manifest.json")
		elif not path.name.startswith(".") and path.name != "manifest.json":
			archive.write(path, arcname = path.name)

print("All done.")
