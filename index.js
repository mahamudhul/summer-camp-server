const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
// const morgan = require('morgan')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

require('dotenv').config()

// payment scret key
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY)
const port = process.env.PORT || 5000;



// middleware
app.use(cors());
app.use(express.json())
// app.use(morgan('dev'))




const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        console.log('crusshhhh')
        return res.status(401).send({ error: true, message: 'unauthorized access' });
    }


    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {

            return res.status(401).send({ error: true, message: 'unauthorized access 2' })
        }
        req.decoded = decoded;
        next();
    })
}





const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.ojw1kya.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();




        // all API collection
        const classCollection = client.db("summerDB").collection("classes");
        const instructorCollection = client.db("summerDB").collection("instructors");
        const usersCollection = client.db("summerDB").collection("users");
        const cartCollection = client.db("summerDB").collection("carts");
        const paymentCollection = client.db("summerDB").collection("payments");





        // JWT
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })

            res.send({ token })
        })


        // verify admin 
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            console.log(email)
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }


        // verify instructors
        const verifyInstructors = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }











        // Classes API
        app.get('/classes', async (req, res) => {
            const result = await classCollection.find().toArray();
            res.send(result)
        })

        // get instructor add data
        app.get('/classes/:email', verifyJWT, verifyInstructors, async (req, res) => {
            const email = req.params.email;
            const query = { email: email }
            const result = await classCollection.find(query).toArray()

            console.log(result)
            res.send(result)
        })

        app.post('/classes', async (req, res) => {
            const item = req.body;
            console.log(item);
            const result = await classCollection.insertOne(item);
            res.send(result);
        })

        app.patch("/classes/:id", async (req, res) => {
            const id = req.params.id
            const updateClassData = req.body
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    ...updateClassData
                }
            }
            const result = await classCollection.updateOne(filter, updateDoc)
            res.send(result)
        })






        // instructors API
        app.get('/instructors', async (req, res) => {
            const result = await instructorCollection.find().toArray();
            res.send(result)
        })




        // Users API
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });


        app.post('/users', async (req, res) => {
            const user = req.body;
            console.log(user);
            const query = { email: user.email }
            const existingUser = await usersCollection.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })




        // Admin 
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })



        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })



        // instructors
        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }

            const query = { email: email }
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })


        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id);
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })



        // cart Api 
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            // console.log(email)
            if (!email) {
                return res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (email !== decodedEmail) {
                return res.status(403).send({ error: true, message: 'forbidden access' })
            }

            const query = { email: email };
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })


        app.post('/carts', async (req, res) => {
            const item = req.body;
            // console.log(item);
            const result = await cartCollection.insertOne(item);
            res.send(result);
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })


        app.get("/carts/:id", async (req, res) => {
            const id = req.params.id
            // console.log(id)
            const filter = { _id: new ObjectId(id) }
            const data = await cartCollection.findOne(filter)
            res.send(data)
        })






        // create payment intent
        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);
            // console.log(price, amount)

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            });

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        });




        // payment related api
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            console.log(payment)
            const insertResult = await paymentCollection.insertOne(payment)

            const query = { _id: { $in: (new ObjectId(payment)) } }

            // delete all payment classes
            const deleteResult = await cartCollection.deleteOne(query)

            res.send({ insertResult, deleteResult });
        })

        app.get('/payments', async (req, res) => {
            const result = await paymentCollection.find().toArray();
            res.send(result)
        })









        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);







app.get('/', (req, res) => {
    res.send('Student is Joining')
})

app.listen(port, () => {
    console.log(`Summer camp is sitting on port: ${port}`)
})