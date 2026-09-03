FROM node:20-alpine AS base

WORKDIR /app

COPY package*.json ./

RUN npm ci --only=production

COPY . .

# Crear directorio de uploads con permisos para el usuario node
RUN mkdir -p uploads/productos uploads/compras uploads/comprobantes uploads/comprobantes-pago && \
    chown -R node:node /app

ENV NODE_ENV=production

USER node

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "const p=process.env.PORT||3000;const req=require('http').get('http://localhost:'+p+'/api/health/ready',res=>{process.exit(res.statusCode===200?0:1)});req.on('error',()=>process.exit(1));setTimeout(()=>process.exit(1),4000);"

CMD ["node", "src/index.js"]
