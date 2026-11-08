"""Read-only sanity check for an EAS iOS archive's widget extension."""

import plistlib
import sys
import zipfile


archive = sys.argv[1]
app = "Payload/app.app/"
extension = app + "PlugIns/ExpoWidgetsTarget.appex/"

with zipfile.ZipFile(archive) as ipa:
    for label, prefix in (("app", app), ("widget", extension)):
        info = plistlib.loads(ipa.read(prefix + "Info.plist"))
        print(label, {
            "bundle": info.get("CFBundleIdentifier"),
            "version": info.get("CFBundleShortVersionString"),
            "build": info.get("CFBundleVersion"),
            "appGroup": info.get("ExpoWidgetsAppGroupIdentifier"),
            "extension": info.get("NSExtension"),
        })
        profile = ipa.read(prefix + "embedded.mobileprovision")
        start, end = profile.find(b"<plist"), profile.find(b"</plist>")
        if start >= 0 and end >= 0:
            provision = plistlib.loads(profile[start : end + len(b"</plist>")])
            print(label, "provisionGroups", provision.get("Entitlements", {}).get("com.apple.security.application-groups"))
    executable = ipa.read(extension + "ExpoWidgetsTarget")
    for marker in ("OpenHomeTimelineProvider", "OpenHomeWidgetContent", "残り—日"):
        print(ascii(marker), marker.encode("utf-8") in executable)
