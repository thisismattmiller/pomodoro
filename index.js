const express = require('express')
const session = require('express-session');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const sizeOf = require('image-size');

const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();


const app = express()

const port = 3000
const path = require('path');
const htmlFolder = path.join(__dirname, 'app/html');


app.use(express.static('app'))
app.use(fileUpload({ safeFileNames: true, preserveExtension: true }));

app.use(session({
  secret: 'My suureqqet',
  resave: true,
  saveUninitialized: true
}));


// app.use(passport.initialize());
// app.use(passport.session());
app.set('view engine', 'ejs');
app.set('views', './app/html/');
app.use(bodyParser.urlencoded({limit: '20mb', extended: true}));
app.use(express.json({limit: '20mb', extended: true}));


app.get('/', function(req, res) {

	req.session.hasSession = true
	// console.log(req.user)
	// console.log(req.isAuthenticated())
    // res.sendFile(path.join(htmlFolder, 'index.html'));
    // res.render('index',{isAuthenticated: req.isAuthenticated(), user:req.user})
    res.render('index',{})
});


app.get('/image/:id', function(req, res) {

	let id = req.params.id
	if (id.length!=36){
		res.status(500).send('Bad ID?');
		return
	}
	if (id.split('-').length != 5){
		res.status(500).send('Bad ID?');
		return
	}


	res.sendFile('/tmp_data/' +id );
});



app.get('/work/:id', function(req, res) {
	// console.log(req.user)
	// console.log(req.isAuthenticated())
    // res.sendFile(path.join(htmlFolder, 'index.html'));
    // res.render('index',{isAuthenticated: req.isAuthenticated(), user:req.user})
    res.render('work',{id:req.params.id})
});


app.get('/meta/:id', function(req, res) {


	

	let id = req.params.id
	if (id.length!=36){
		res.status(500).send('Bad ID?');
		return
	}
	if (id.split('-').length != 5){
		res.status(500).send('Bad ID?');
		return
	}

	fs.exists('/tmp_data/' + id + '.json', function(exists) {

		if (exists) {
			fs.readFile('/tmp_data/' + id + '.json', function readFileCallback(err, data) {
		    	res.setHeader('Content-Type', 'application/json')
		    	res.status(200).send(data)
			})
		}else{
			res.status(404).send('Not found')
		}

	})


    
});


app.post('/upload', function(req, res) {
  if (!req.files || Object.keys(req.files).length === 0) {
    return res.status(400).send('No files were uploaded.');
  }




	let detect = async function(fileName){
		const [result] = await client.textDetection(fileName);
		let dimensions = sizeOf(fileName);
		result.dimensions = dimensions	
		result.filename = req.files.file.name

		let json = JSON.stringify(result);
		// get the dimesntions of the image


		fs.writeFile(fileName + '.json', json, ()=>{});
		return result
	}


  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
  let sampleFile = req.files.file;

  let id = uuidv4()
  let filename = '/tmp_data/'+id

  // Use the mv() method to place the file somewhere on your server
  sampleFile.mv(filename, function(err) {
    if (err)
      return res.status(500).send(err);

  	detect(filename)
	// console.log('Text:');
	// detections.forEach(text => console.log(text));

    if (!req.session.hasSession){
    	id = "That didnt work"
    }
    res.render('uploaded',{id:id})
  });
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
