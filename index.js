const express = require("express");
const app = express();
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");

const port = process.env.PORT || 2500;

// middleware
app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
	const authorization = req.headers.authorization;
	if (!authorization) {
		return res
			.status(401)
			.send({ error: true, message: "unauthorized access" });
	}
	const token = authorization.split(" ")[1];

	jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
		if (err) {
			return res
				.status(401)
				.send({ error: true, message: "unauthorized access" });
		}
		req.decoded = decoded;
		next();
	});
};

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const uri = `${process.env.Mongo_URI}`;

const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		// await client.connect();

		const usersCollection = client.db("gurukulDB").collection("users");
		const addedUsersCollection = client
			.db("gurukulDB")
			.collection("addedUsers");

		app.post("/jwt", (req, res) => {
			const user = req.body;
			const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
				expiresIn: "7d",
			});

			res.send({ token });
		});

		const verifyAdmin = async (req, res, next) => {
			const email = req.decoded.email;
			const query = { email: email };
			const user = await usersCollection.findOne(query);
			if (user?.role !== "admin") {
				return res.status(403).send({
					error: true,
					message: "forbidden access!",
				});
			}
			next();
		};

		// >> users api
		app.get("/users", async (req, res) => {
			let query = {};

			if (req.query?.email) {
				query.email = {
					$regex: req.query.email,
					$options: "i",
				};
			}

			if (req.query?.name) {
				query.name = { $regex: req.query.name, $options: "i" };
			}

			if (req.query?.role) {
				query.role = { $regex: req.query.role, $options: "i" };
			}

			const result = await usersCollection.find(query).toArray();
			res.send(result);
		});

		app.get("/users/:role/:email", async (req, res) => {
			const role = req.params.role;
			const email = req.params.email;

			if (email !== req.decoded.email) {
				return res.send({ [role]: false });
			}

			const query = { email: email };
			const user = await usersCollection.findOne(query);
			const result = { [role]: user?.role === role };
			res.send(result);
		});

		app.patch("/users/:email", async (req, res) => {
			const { email } = req.params;
			const { role } = req.body;

			try {
				await usersCollection.updateOne(
					{ email: email },
					{ $set: { role: role } }
				);

				res.status(200).send({
					message: "User role updated successfully",
				});
			} catch (error) {
				res.status(500).send({
					error: "Internal server error",
				});
			}
		});

		app.post("/users", async (req, res) => {
			const user = req.body;
			const query = { email: user.email };
			const existingUser = await usersCollection.findOne(query);

			if (existingUser) {
				return res.send({ message: "user already exists" });
			}

			const result = await usersCollection.insertOne(user);
			res.send(result);
		});

		app.delete("/users/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await usersCollection.deleteOne(query);
			res.send(result);
		});

		// >> addedUsers api
		app.post("/addedUsers", async (req, res) => {
			const users = req.body;
			users.createdAt = new Date();
			const result = await addedUsersCollection.insertOne(users);
			res.send(result);
		});

		app.get("/addedUsers", async (req, res) => {
			let query = {};

			if (req.query?.email) {
				query.email = {
					$regex: req.query.email,
					$options: "i",
				};
			}
			if (req.query?.name) {
				query.name = { $regex: req.query.name, $options: "i" };
			}

			const result = await addedUsersCollection.find(query).toArray();
			res.send(result);
		});

		app.get("/addedUsers/:id", async (req, res) => {
			const id = req.params.id;
			try {
				const queryWithObjectId = { _id: new ObjectId(id) };
				const result = await addedUsersCollection.findOne(
					queryWithObjectId
				);

				if (!result) {
					const queryWithoutObjectId = { _id: id };
					const fallbackResult = await addedUsersCollection.findOne(
						queryWithoutObjectId
					);

					if (!fallbackResult) {
						res.status(404).send("Product not found");
						return;
					}

					res.send(fallbackResult);
					return;
				}

				res.send(result);
			} catch (error) {
				console.error("Error:", error);
				res.status(500).send("Internal Server Error");
			}
		});

		app.delete("/addedUsers/:id", async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await addedUsersCollection.deleteOne(query);
			res.send(result);
		});

		app.put("/addedUsers/:id", async (req, res) => {
			const id = req.params.id;
			const filter = { _id: new ObjectId(id) };
			const options = { upsert: true };

			const updatedPost = req.body;
			const user = {
				$set: {
					photo: updatedPost.name,
					body: updatedPost.email,
					type: updatedPost.phone,
				},
			};
			const result = await addedUsersCollection.updateOne(
				filter,
				user,
				options
			);
			res.send(result);
		});

		// Send a ping to confirm a successful connection
		await client.db("admin").command({ ping: 1 });
		console.log(
			"Pinged your deployment. You successfully connected to MongoDB!"
		);
	} finally {
		// await client.close();
	}
}
run().catch(console.dir);

app.get("/", (req, res) => {
	res.send("Mindful Gurukul server is running!");
});

app.listen(port, () => {
	console.log(`Mindful Gurukul server is live on port ${port}`);
});
