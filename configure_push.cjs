const { CapacitorProject } = require('@capacitor/project');

async function main() {
    try {
        console.log('Loading Capacitor project...');
        const project = new CapacitorProject({
            ios: { path: 'ios/App' }
        });
        
        await project.load();

        console.log('Setting Push Notifications capability...');
        
        // Ensure App.entitlements is referenced
        const entitlementsPath = 'App/App.entitlements';
        await project.ios.setEntitlements('App', entitlementsPath, {
            'aps-environment': 'development'
        });

        // Add System Capabilities to pbxproj directly using the internal pbxproj wrapper
        const pbx = project.ios.getPbxProject();
        
        // This is equivalent to clicking "+ Capability" -> "Push Notifications" in Xcode
        pbx.addTargetAttribute('SystemCapabilities', {
            'com.apple.Push': { enabled: 1 }
        }, 'App');

        await project.commit();
        console.log('Successfully added Push Notification capabilities to the Xcode project.');
    } catch (e) {
        console.error('Failed to update project:', e);
    }
}

main();
