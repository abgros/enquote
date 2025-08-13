import os
import zipfile

# compile for Chrome
with zipfile.ZipFile("enquote.zip", "w", zipfile.ZIP_DEFLATED) as archive:
	for path in os.listdir('.'):
		if not path.startswith(".") and not path.endswith(".zip") and not path.endswith(".py")  and path != "manifest-firefox.json":
			archive.write(path)

# compile for Firefox
with zipfile.ZipFile("enquote-firefox.zip", "w", zipfile.ZIP_DEFLATED) as archive:
	for path in os.listdir('.'):
		if path == "manifest-firefox.json":
			archive.write(path, arcname = "manifest.json")
		elif not path.startswith(".") and not path.endswith(".zip") and not path.endswith(".py") and path != "manifest.json":
			archive.write(path)

print("All done.")