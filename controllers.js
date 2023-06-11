const ProjectsGroups = require('@crowdin/crowdin-api-client').ProjectsGroups;
const CrowdinSourceFiles = require('@crowdin/crowdin-api-client').SourceFiles;
const CrowdinTranslations = require('@crowdin/crowdin-api-client').Translations;

const https = require('https');
const db = require('better-sqlite3')('data.db');

exports.index = async function (req, res) {
    console.log(req.cookies);
    if (req.cookies.Token === undefined) {
        res.redirect('/login');
    };

    const sourceFilesApi = new CrowdinSourceFiles({
        token: req.cookies.Token
    });

    const projectsGroupsApi = new ProjectsGroups({
        token: req.cookies.Token,
    });

    let tree;
    try {
        const directories = await sourceFilesApi.listProjectDirectories(req.cookies.ProjectID);
        const files = await sourceFilesApi.listProjectFiles(req.cookies.ProjectID);
        tree = directories.data.concat(files.data).map(obj => {
            obj.data.parent_id = obj.data.directoryId;
            if (obj.data.directoryId === null) {
                obj.data.parent_id = 0;
            };
            if (obj.data.exportPattern === null) {
                obj.data.node_type = "0";
            };
            return obj.data;
        });
    } catch (error) {
        console.error(error);
    }

    let targetLanguageIds = [];
    try {
        const projectInfo = (await projectsGroupsApi.getProject(req.cookies.ProjectID)).data;
        targetLanguageIds = projectInfo.targetLanguageIds;
        console.log(targetLanguageIds);
    } catch(error) {
        console.error(error);
    }

    res.render(__dirname + '/pages/index.ejs', { 
        tree: { data: tree }, 
        targetLanguageIds: targetLanguageIds 
    });
};

exports.storeLogin = async function (req, res) {
    const accessToken = req.body.accessToken;
    const projectID = req.body.projectID;

    let errorTitle;
    let errorMessage;
    let redirectPath;
    let statusCode;

    if (accessToken === '' || projectID === '') {
        statusCode = 400;
        errorTitle = 'Bad request';
        errorMessage = 'The data you passed is missing';
        redirectPath = '/login';
    } else {
        const projectsGroupsApi = new ProjectsGroups({
            token: req.body.accessToken,
        });
        
        try {
            const response = await projectsGroupsApi.getProject(req.body.projectID);
            console.log('Write to DB');
            statusCode = 201;
            redirectPath = '/';
            res.cookie('Token', accessToken);
            res.cookie('ProjectID', projectID);

            encodeToken = btoa(accessToken);
            try {
                const stmt = db.prepare(`INSERT INTO tokens (ProjectID, Token) VALUES('${projectID}', '${encodeToken}');`);
                const result = stmt.run();
            } catch (error) {
                console.error(error);
            }
            
        } catch (error) {
            if (error.code === 404) {
                statusCode = 404;
                errorTitle = 'Not found';
                errorMessage = 'Project with entered ID not found';
                redirectPath = '/login';
            } else if (error.code === 401) {
                statusCode = 401;
                errorTitle = 'Unauthorized';
                errorMessage = 'Personal access token is incorrect';
                redirectPath = '/login';
            } else {
                statusCode = 500;
                errorTitle = 'Unknown error';
                errorMessage = 'An unknown error has occurred';
                redirectPath = '/login';
            }
        }
    }

    res.statusCode = statusCode;
    res.cookie('Error title', errorTitle, { httpOnly: true });
    res.cookie('Error message', errorMessage, { httpOnly: true });
    res.redirect(redirectPath);
};

exports.login = function (req, res) {
    const errorTitle = req.cookies['Error title'];
    const errorMessage = req.cookies['Error message'];

    res.clearCookie('Error title', { httpOnly: true });
    res.clearCookie('Error message', { httpOnly: true });

    res.render(__dirname + '/pages/login.ejs', { 
        errorTitle: errorTitle,
        errorMessage: errorMessage
    });
};

async function downloadFile(url, data) {
    return new Promise((resolve) => {
        https.get(url, (res) => {
            res.on('data', (d) => {
                data.push(d);
            });
            res.on('end', () => {
                resolve(data);
            });
        });
    })
}

exports.download = async function (req, res) {
    const translationsApi = new CrowdinTranslations({
        token: req.cookies.Token
    });

    let data = [];
    try {
        console.log('work');
        console.log(req.body);
        const request = {
            targetLanguageId: req.body.selectedLang,
            format: "xliff",
            fileIds: req.body.selectedFilesIds
        }
        const url = (await translationsApi.exportProjectTranslation(req.cookies.ProjectID, request)).data.url;

        await downloadFile(url, data);
    } catch(error) {
        console.error(error);
    };

    res.setHeader('Content-Type', 'application/xliff+xml');
    res.setHeader('Content-Disposition', 'attachment; filename=sample.xliff');
    res.write(Buffer.concat(data).toString(), 'binary');
    res.end();
}
