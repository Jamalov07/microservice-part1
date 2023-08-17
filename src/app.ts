import * as express from "express";
import { Request, Response } from "express";
import * as cors from "cors";
import AppDataSource from "../ormconfig";
import { Product } from "./entity/product";
import * as amqp from "amqplib/callback_api";
import * as dotenv from "dotenv";
dotenv.config();
AppDataSource.initialize()
    .then((db) => {
        const productRepository = db.getRepository(Product);

        amqp.connect(process.env.AMQP, (error0, connection) => {
            if (error0) {
                throw error0;
            }
            connection.createChannel((error1, channel) => {
                if (error1) {
                    throw error1;
                }
                const app = express();
                console.log("Database connected!");
                app.use(cors());
                app.use(express.json());

                app.get("/product", async (req: Request, res: Response) => {
                    const products = await productRepository.find();
                    res.json(products);
                });

                app.post("/product", async (req: Request, res: Response) => {
                    console.log(req.body);
                    const product = productRepository.create(req.body);
                    const result = await productRepository.save(product);
                    channel.sendToQueue("product_created", Buffer.from(JSON.stringify(result)));
                    return res.json(result);
                });

                app.get("/product/:id", async (req: Request, res: Response) => {
                    const product = await productRepository.findOneBy({ id: +req.params.id });
                    return res.json(product);
                });

                app.put("/product/:id", async (req: Request, res: Response) => {
                    const product = await productRepository.findOneBy({ id: +req.params.id });
                    productRepository.merge(product, req.body);
                    const result = await productRepository.save(product);
                    channel.sendToQueue("product_updated", Buffer.from(JSON.stringify(result)));
                    return res.json(result);
                });

                app.delete("/product/:id", async (req: Request, res: Response) => {
                    const result = await productRepository.delete({ id: +req.params.id });
                    channel.sendToQueue("product_deleted", Buffer.from(req.params.id));

                    return res.send(result);
                });

                app.post("/product/:id/like", async (req: Request, res: Response) => {
                    const product = await productRepository.findOneBy({ id: +req.params.id });
                    product.likes++;
                    const result = await productRepository.save(product);
                    return res.json(result);
                });
                app.listen(3000, () => {
                    console.log("Server listening on port 3000!");
                });

                process.on("beforeExit", () => {
                    console.log("closing");
                    connection.close();
                });
            });
        });
    })
    .catch((err) => console.log(err));
