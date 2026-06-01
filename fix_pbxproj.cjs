const xcode = require('xcode');
const fs = require('fs');
const path = require('path');

const projectPath = 'ios/App/App.xcodeproj/project.pbxproj';
const myProj = xcode.project(projectPath);

myProj.parseSync();
myProj.addResourceFile('App/GoogleService-Info.plist');

fs.writeFileSync(projectPath, myProj.writeSync());
console.log('Successfully added GoogleService-Info.plist to project.pbxproj');
