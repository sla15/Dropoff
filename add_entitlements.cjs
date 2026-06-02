const xcode = require('xcode');
const fs = require('fs');

const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';
const myProj = xcode.project(projectPath);

myProj.parseSync();

// Add UIBackgroundModes to Info.plist via regular regex (easier than xcode package for plist)
const infoPlistPath = 'ios/App/App/Info.plist';
let infoPlist = fs.readFileSync(infoPlistPath, 'utf8');

if (!infoPlist.includes('UIBackgroundModes')) {
    infoPlist = infoPlist.replace('</dict>\n</plist>', '\t<key>UIBackgroundModes</key>\n\t<array>\n\t\t<string>remote-notification</string>\n\t</array>\n</dict>\n</plist>');
    fs.writeFileSync(infoPlistPath, infoPlist);
    console.log('Added UIBackgroundModes to Info.plist');
}

// Add App.entitlements
const entitlementsPath = 'ios/App/App/App.entitlements';
if (!fs.existsSync(entitlementsPath)) {
    const entitlementsContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>aps-environment</key>
    <string>development</string>
</dict>
</plist>`;
    fs.writeFileSync(entitlementsPath, entitlementsContent);
    console.log('Created App.entitlements');
}

// Add entitlements file to project
if (!myProj.pbxFileReferenceSection()) {
    console.log("No file reference section found");
} else {
    try {
        myProj.addResourceFile('App/App.entitlements');
        
        // Add CODE_SIGN_ENTITLEMENTS to build settings
        const configurations = myProj.pbxXCBuildConfigurationSection();
        for (const config in configurations) {
            const buildSettings = configurations[config].buildSettings;
            if (buildSettings) {
                buildSettings['CODE_SIGN_ENTITLEMENTS'] = '"App/App.entitlements"';
            }
        }
        
        fs.writeFileSync(projectPath, myProj.writeSync());
        console.log('Added entitlements to pbxproj');
    } catch (e) {
        console.error('Error modifying pbxproj:', e);
    }
}
