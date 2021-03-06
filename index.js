const sqlite3 = require('sqlite3').verbose();
var express = require('express');
var exphbs  = require('express-handlebars');
var bodyParser = require('body-parser');
var ddg = require('duckduckgo-images-api');

let db = new sqlite3.Database('./flowers2019.db', sqlite3.OPEN_READWRITE, (err) => {
    if(err) {
        console.error(err.message);
    }
    console.log('Connected to flowers!!!');
});

var app = express();

app.engine('handlebars', exphbs());
app.set('view engine', 'handlebars');
app.use(bodyParser.urlencoded({ extended: true }));
 
app.get('/', function (req, res) {
    db.serialize(() => {
        db.all(`SELECT comname AS name, species AS spec, genus AS gen FROM flowers`, (err, rows) => {
          db.run(`CREATE TABLE IF NOT EXISTS log(type TEXT, name TEXT);`, function (err, result) {
            db.run(`CREATE TRIGGER IF NOT EXISTS log_insert BEFORE INSERT ON sightings BEGIN INSERT INTO log (type, name) VALUES('INSERT', NEW.name); END;`, function (err, result) {
              db.run(`CREATE TRIGGER IF NOT EXISTS log_update BEFORE UPDATE ON flowers BEGIN INSERT INTO log (type, name) VALUES('UPDATE', NEW.comname); END;`, function (err, result) {
                if (err) {
                  console.error(err.message);
                }
                res.render('home', {names: rows});
              });
            });
          });
        });
    });
});
/*db.run(`create trigger if not exists log_insert before insert on SIGHTINGS BEGIN INSERT INTO log (type, name) VALUES('INSERT', '${req.body.flower}'); END;`, function (err, result) {
  if (err) throw err;
  console.log("Logged.");
});*/

app.get('/sighted/:flower', function (req, res) {
    db.serialize(() => {
        db.all(`SELECT sighted AS date, location AS loc, person AS person, name as name FROM sightings WHERE name == "${req.params.flower}" ORDER BY sighted LIMIT 10`, (err, rows) => {
          db.all(`SELECT comname AS name, species AS spec, genus AS gen FROM flowers WHERE comname == "${req.params.flower}"`, (err, flowers) => {
            ddg.image_search({ query: `${req.params.flower} flower`, moderate: true }).then((images) => {
              if (err) {
                console.error(err.message);
              }
              res.render('sighted', {names: rows, flower: flowers[0], image: images[0].image});
            });
          });
        });
    });
});

app.get('/person/:person', function (req, res) {
    db.serialize(() => {
        db.all(`SELECT name AS flower, sighted AS date, location AS loc FROM sightings WHERE person == "${req.params.person}"`, (err, rows) => {
          if (err) {
            console.error(err.message);
          }
          res.render('person', {names: rows, person_name: req.params.person});
        });
    });
});

app.post('/:flower/update', function (req, res) {
  db.serialize(() => {
    db.all(`UPDATE flowers SET genus = '${req.body.genus}', species = '${req.body.species}', comname = '${req.body.common}' WHERE comname == "${req.params.flower}"`, (err, rows) => {
      db.all(`UPDATE sightings SET name = '${req.body.common}' WHERE name == "${req.params.flower}"`, (err, rows) => {
        if (err) {
          console.error(err.message);
        }
        res.redirect(`/sighted/${req.body.common}`);
      });
    });
  });
});

app.post('/insert', function (req, res) {
  db.run(`INSERT INTO sightings (name, person, location, sighted) VALUES('${req.body.flower}', '${req.body.person}', '${req.body.loc}', '${req.body.date}')`, function (err, result) {
    if (err) throw err;
    console.log("Inserted to sightings.");
  });
  db.run(`INSERT INTO flowers (comname, genus, species) VALUES('${req.body.flower}', 'No genus', 'No species')`, function (err, result) {
    if (err) throw err;
    console.log("Inserted to flowers.");
  });
  res.redirect(`/`);
});

app.get('/delete/:flower', function (req, res) {
  db.run(`DELETE FROM flowers WHERE comname == '${req.params.flower}'`, function (err, result) {
    if (err) throw err;
    console.log(`Deleted ${req.params.flower} from flowers.`);
  });
  db.run(`DELETE FROM sightings WHERE name == '${req.params.flower}'`, function (err, result) {
    db.run(`INSERT INTO log (type, name) VALUES('DELETE', '${req.params.flower}')`, function (err, result) {
      if (err) throw err;
      console.log(`Deleted ${req.params.flower} from sightings.`);
    });
  });
  res.redirect(`/`);
});

app.get('/log', function (req, res) {
  db.serialize(() => {
      db.all(`SELECT type AS type, name AS name FROM log`, (err, rows) => {
          if (err) {
            console.error(err.message);
          }
          res.render('log', {names: rows});
      });
  });
});
 
app.listen(3000);
