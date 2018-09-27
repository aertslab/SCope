console.log("Configuring SCope...")
const makeDir = require('make-dir');
makeDir('assets').then(path => {
    console.log(path + " directory created.");
    console.log("SCope ready for 'npm run dev' or 'npm run build'");
});