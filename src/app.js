
import { MongoClient, ObjectID } from "mongodb";
import { GraphQLServer } from "graphql-yoga";

import "babel-polyfill";

const usr = "adrian";
const pwd = "12345";
const url = "server1-zlr9p.mongodb.net/test?retryWrites=true&w=majority";

/**
 * Connects to MongoDB Server and returns connected client
 * @param {string} usr MongoDB Server user
 * @param {string} pwd MongoDB Server pwd
 * @param {string} url MongoDB Server url
 */
const connectToDb = async function(usr, pwd, url) {
  const uri = `mongodb+srv://${usr}:${pwd}@${url}`;
  const client = new MongoClient(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true
  });

  await client.connect();
  return client;
};

const getDateTime = () => {
  var today = new Date();
  var date = today.getFullYear() + '-' + (today.getMonth() + 1) + '-' + today.getDate();
  var time = today.getHours() + ':' + today.getMinutes() + ':' + today.getSeconds();
  var dateTime = date + ' ' + time;

  return dateTime;
}

/**
 * Starts GraphQL server, with MongoDB Client in context Object
 * @param {client: MongoClinet} context The context for GraphQL Server -> MongoDB Client
 */
const runGraphQLServer = function(context) {
  const typeDefs = `
    type Query{
      getAuthor(id: ID!): Author
      getAuthors: [Author]!
      getIngredient(id: ID!): Ingredient
      getIngredients: [Ingredient]!
      getRecipes: [Recipe]!
    }

    type Mutation{
      addAuthor(name: String!, email: String!):Author!
      addIngredient(name: String!):Ingredient!
      addRecipe(title: String!, description: String!, author: ID!, ingredients: [ID!]): Recipe!
      deleteAuthor(author: String!): String
      deleteIngredient(ingredient: String!): String
      deleteRecipe(name: String!): String
      updateAuthor(id: ID!, newName: String, newMail: String): Author!
      updateIngredient(id: ID!, newName: String): Ingredient!
      updateRecipe(id: ID!, newTitle: String, newDescription: String, newAuthor: String, newIngredients: String): Recipe!

    }

    type Author{
      id: ID!
      name: String!
      email: String!
      recipes: [Recipe!]
    }
    type Ingredient{
      id: ID!
      name: String!
      recipes: [Recipe!]
    }

    type Recipe {
      id: ID!
      title: String!
      description: String!
      date: String!
      author: Author!
      ingredients: [Ingredient!]!
    }

    `;

  const resolvers = {
    Query: {
      getAuthor: async (parent, args, ctx, info) => {
        const { id } = args;
        const { client } = ctx;
        const db = client.db("recipes");
        const collection = db.collection("authors");
        const result = await collection.findOne({ _id: ObjectID(id) });
        return result;
      },
      getAuthors: async (parent, args, ctx, info) => {
        const { client } = ctx;
        const db = client.db("recipes");
        const collection = db.collection("authors");
        const result = await collection.find({}).toArray();
        return result;
      },

      getIngredient: async (parent, args, ctx, info) => {
        const { id } = args;
        const { client } = ctx;
        const db = client.db("recipes");
        const collection = db.collection("ingredients");
        const result = await collection.findOne({ _id: ObjectID(id) });
        return result;
      },

      getIngredients: async (parent, args, ctx, info) => {
        const { client } = ctx;
        const db = client.db("recipes");
        const collection = db.collection("ingredients");
        const result = await collection.find({}).toArray();
        return result;
      },

      getRecipes: async (parent, args, ctx, info) => {
        const { client } = ctx;
        const db = client.db("recipes");
        const collection = db.collection("recipe");
        const result = await collection.find({}).toArray();
        return result;

      },

    },
    Mutation: {
      addAuthor: async (parent, args, ctx, info) => {
        const { name, email } = args;
        const { client } = ctx;

        const db = client.db("recipes");
        const collection = db.collection("authors");

        if (await collection.findOne({email})) {throw new Error(`Author with email ${email} already exists`)}

        const result = await collection.insertOne({ name, email });

        return {
          name,
          email,
          id: result.ops[0]._id
        };
      },

      addIngredient: async(parent,args,ctx, info)=>{
        const { name } = args;
        const { client } = ctx;

        const db = client.db("recipes");
        const collection = db.collection("ingredients");

        if (await collection.findOne({name})) {throw new Error(`Ingredient with name ${name} already exists`)}

        const result = await collection.insertOne({name});

        return {
          name,
          id: result.ops[0]._id
        };
      },

      addRecipe: async (parent, args, ctx, info) => {

        const { client } = ctx;

        const title = args.title;
        const description = args.description;
        const date = getDateTime();
        const author = args.authorMail;
        const ingredients = args.ingredients;

        const db = client.db("recipes");
        const recipesCollection = db.collection("recipe");
        const authorsCollection = db.collection("authors");

        if (await recipesCollection.findOne({title: title})) throw new Error(`Recipe with title ${title} already exists`)
        if (await !authorsCollection.findOne({email: author})) throw new Error(`Author with email ${author} doesn't exist`)

        const authorFindResult = await authorsCollection.findOne({ email: author })

        const recipeIngredientsArr = []
        let recipeIngredientsObj = {}
        ingredients.forEach( obj => {
          recipeIngredientsObj = {
            name: obj
          }
          recipeIngredientsArr.push(recipeIngredientsObj)
        })
        
        const result = await recipesCollection.insertOne({ title, description, date, author, ingredients });

        return {
          _id: result.ops[0]._id,
          title: title,
          description: description,
          date: date,
          author: authorFindResult,
          ingredients: recipeIngredientsArr,
        }

      },

      deleteRecipe: async (parent, args, ctx, info) => {
        const { client } = ctx;
        const recipeName = args.name;

        const db = client.db("recipes");
        const recipesCollection = db.collection("recipe");

        await recipesCollection.deleteOne({ "title": recipeName })

        return `Removed recipe with title: ${recipeName}` 
      },

      deleteAuthor: async (parent, args, ctx, info) => {
        const { client } = ctx;
        const authorMail = args.author;

        const db = client.db("recipes");
        const recipesCollection = db.collection("recipe");
        const authorsCollection = db.collection("authors");

        await recipesCollection.deleteMany({author: authorMail})
        await authorsCollection.deleteOne({mail: authorMail})

        return `Removed author with email ${authorMail} and all recipes with that author`
      },

      deleteIngredient: async (parent, args, ctx, info) => {
        const { client } = ctx;
        const ingredientName = args.ingredient;

        const db = client.db("recipes");
        const recipesCollection = db.collection("recipe");
        const ingredientsCollection = db.collection("ingredients");

        await recipesCollection.deleteMany({ingredients: ingredientName})
        await ingredientsCollection.deleteOne({name: ingredientName})

        return `Removed ingredient with name ${ingredientName} and all recipes with that ingredient`
      },

      updateRecipe: async (parent, args, ctx, info) => {
        const { client } = ctx;
        const recipeId = args.id;
        const newTitle = args.newTitle;
        const newDescription = args.newDescription;
        const newAuthor = args.newAuthor;
        const newIngredients = args.newIngredients;


        const db = client.db("recipes");
        const recipesCollection = db.collection("recipe");

        if(newTitle) {
          await recipesCollection.updateOne(
            { "_id": ObjectID(recipeId) }, 
            { $set: {"title": newTitle} }
          );
        }

        if(newDescription) {
          await recipesCollection.updateOne(
            { "_id": ObjectID(recipeId) }, 
            { $set: {"description": newDescription} } // 
          );
        }

        if(newAuthor) {
          await recipesCollection.updateOne(
            { "_id": ObjectID(recipeId) }, 
            { $set: {"author": newAuthor} } 
          );
        }

        if(newIngredients) {
          await recipesCollection.updateOne(
            { "_id": ObjectID(recipeId) }, 
            { $set: {"ingredients": newIngredients} } 
          );
        }

        const result = await recipesCollection.findOne({ _id: ObjectID(recipeId) }); 
        
        return result
      },

      updateAuthor: async (parent, args, ctx, info) => {
        const { client } = ctx;
        const authorId = args.id;
        const newName = args.newName;
        const newMail = args.newMail;


        const db = client.db("recipes");
        const authorsCollection = db.collection("authors");

        if(newName) {
          await authorsCollection.updateOne(
            { "_id": ObjectID(authorId) },
            { $set: {"name": newName} } 
          );
        }

        if(newMail) {
          await authorsCollection.updateOne(
            { "_id": ObjectID(authorId) }, 
            { $set: {"email": newMail} } 
          );
        }

        const result = await authorsCollection.findOne({ _id: ObjectID(authorId) }); 
        
        return result
      },

      updateIngredient: async (parent, args, ctx, info) => {
        const { client } = ctx;
        const ingredientId = args.id;
        const newName = args.newName;


        const db = client.db("recipes");
        const ingredientsCollection = db.collection("ingredients");

        if(newName) {
          await ingredientsCollection.updateOne(
            { "_id": ObjectID(ingredientId) }, 
            { $set: {"name": newName} } 
          );
        }
        const result = await ingredientsCollection.findOne({ _id: ObjectID(ingredientId) }); 
        
        return result
      },

    }
  };

  const server = new GraphQLServer({ typeDefs, resolvers, context });
  const options = {
    port: 8000
  };

  try {
    server.start(options, ({ port }) =>
      console.log(
        `Server started, listening on port ${port} for incoming requests.`
      )
    );
  } catch (e) {
    console.info(e);
    server.close();
  }
};

const runApp = async function() {
  const client = await connectToDb(usr, pwd, url);
  console.log("Connect to Mongo DB");
  try {
    runGraphQLServer({ client });
  } catch (e) {
    client.close();
  }
};

runApp();