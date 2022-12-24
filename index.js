const express = require('express')
const session = require('express-session');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const sizeOf = require('image-size');
const glob = require("glob")

const vision = require('@google-cloud/vision');
const client = new vision.ImageAnnotatorClient();

const { spawnSync } = require( 'child_process' );


const app = express()

const port = 5555
const path = require('path');
const htmlFolder = path.join(__dirname, 'app/html');


const MAX_PDF_PAGE = 10



function delay(time) {
  return new Promise(resolve => setTimeout(resolve, time));
} 




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

	if (id.endsWith('.png')){
	
		res.sendFile('/tmp_data/' +id );
	
	}else{


		if (id.length!=36){
			res.status(500).send('Bad ID?');
			return
		}
		if (id.split('-').length != 5){
			res.status(500).send('Bad ID?');
			return
		}


		res.sendFile('/tmp_data/' +id );
	}

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

			// does a status file exist, if so send that instead
			fs.exists('/tmp_data/' + id + '.status', function(exists) {
				if (exists) {
					fs.readFile('/tmp_data/' + id + '.status', function readFileCallback(err, data) {
						res.setHeader('Content-Type', 'application/json')
						res.status(202).send(data)
					})
				}else{
						res.status(404).send('Not found')
				}

			})
			
		}

	})


    
});


app.post('/upload', function(req, res) {
	
	doingExample = false

	if (req.query.example){  	
  	doingExample = true
  }else{
	  if (!req.files || Object.keys(req.files).length === 0) {
	    return res.status(400).send('No files were uploaded.');
	  }

  }






	let detect = async function(fileName, dontWriteOutput){
		const [result] = await client.textDetection(fileName);
		let dimensions = sizeOf(fileName);
		result.dimensions = dimensions	
		if (doingExample){
			result.filename = 'example.png'
		}else{
			result.filename = req.files.file.name	
		}
		

		let json = JSON.stringify(result);
		// get the dimesntions of the image

		if (!dontWriteOutput){
			fs.writeFile(fileName + '.json', json, ()=>{});
		}

		return result
	}





  if (!doingExample){

	  // The name of the input field (i.e. "sampleFile") is used to retrieve the uploaded file
	  let sampleFile = req.files.file;

	  console.log(req.files.file)

	  let id = uuidv4()
	  let filename = '/tmp_data/'+id

	  if (!req.session.hasSession){
	  	id = "That didnt work"
	  }

  	// Use the mv() method to place the file somewhere on your server
	  sampleFile.mv(filename, async function(err) {
	    if (err)
	      return res.status(500).send(err);


	    if (sampleFile.mimetype === 'application/pdf'){

	    	// convert the file to png
	    	fs.writeFileSync(`${filename}.status`, JSON.stringify({status: 'This is a PDF file, starting to split it apart and process, please be have patience.'}));
	    	res.render('uploaded',{id:id})

	    	await delay(2000);
	    	// try to split it apart

	    	const convert = spawnSync( 'convert', [ '-density', '140', '-quality', '100', filename, filename + '.png' ], { encoding: 'utf-8' } );
	    	console.log('convert.stdout',convert.stdout)
	    	console.log('convert.stderr',convert.stderr)


	    	glob(`${filename}-*.png`, {}, async function (er, files) {

	    		if (files.length > MAX_PDF_PAGE){

	    			fs.writeFileSync(`${filename}.status`, JSON.stringify({status: `This PDF has more than the max number of pages, please use a PDF with less than ${MAX_PDF_PAGE} pages.`}));
	    			await delay(1000);

	    		}else{

	    			fs.writeFileSync(`${filename}.status`, JSON.stringify({status: `PDF has been split apart into ${files.length} pages.`}));
	    			await delay(1000);

	    			let all_pages = {

	    				multiMode: true,
	    				pages: [],
	    				files: files.map((v)=>{return v.replace('/tmp_data/','')})

	    			}
						for (const [i, value] of files.entries()) {
							
	    				fs.writeFileSync(`${filename}.status`, JSON.stringify({status: `Working on page: ${i+1}.`}));
	    				await delay(1000);
	    				let page_json = await detect(value, true)

	    				// save some space, we don't use this part of the reponse
	    				if (page_json.fullTextAnnotation){
	    					delete page_json.fullTextAnnotation
	    				}


	    				all_pages.pages.push(page_json)


						}

	    			fs.writeFileSync(`${filename}.status`, JSON.stringify({status: `Building thumbnails.`}));
	    			await delay(1000);

			    	const convert = spawnSync( 'convert', [ '-density', '20', '-quality', '75', filename, filename + '-thumbs.png' ] );


						fs.writeFile(filename + '.json', JSON.stringify(all_pages), ()=>{});


	    		}
	    		


	    	})


	    }else{
	    	detect(filename)
	    	res.render('uploaded',{id:id})
	    		
	    }



				
			// console.log('Text:');
			// detections.forEach(text => console.log(text));
	    
	  });

	 }else{

	  let id = uuidv4()
	  let filename = '/tmp_data/'+id

	 	fs.writeFileSync(filename, fs.readFileSync('/app/demo.png'));
  	detect(filename)
  	res.render('uploaded',{id:id})




	 }


});

app.listen(port, () => console.log(`Example app listening on port ${port}!`))
