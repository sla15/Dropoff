const { CapacitorProject } = require('@capacitor/project');

async function main() {
    try {
        console.log('Loading Capacitor project...');
        const project = new CapacitorProject({
            ios: { path: 'ios' }
        });
        
        await project.load();

        console.log('Setting Push Notifications capability...');
        
        // Add aps-environment entitlement
        await project.ios.addEntitlements('App', null, {
            'aps-environment': 'production'
        });

        // Add System Capabilities to pbxproj
        const pbx = project.ios.getPbxProject();
        
        // This is equivalent to clicking "+ Capability" -> "Push Notifications" in Xcode
        const target = project.ios.getAppTarget();
        if (target) {
            pbx.addTargetAttribute('SystemCapabilities', {
                'com.apple.Push': { enabled: 1 }
            }, target.id);
        } else {
            console.warn('Could not find app target in Xcode project');
        }

        await project.commit();
        console.log('Successfully added Push Notification capabilities to the Xcode project.');
    } catch (e) {
        console.error('Failed to update project:', e);
    }
}

main();
