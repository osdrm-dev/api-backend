import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL est manquant dans les variables d'environnement",
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool, { schema: 'public' });
const prisma = new PrismaClient({ adapter });

async function seedSuppliersData() {
  console.log('🌱 Starting suppliers data seeding...\n');

  try {
    const suppliersData = [
      {
        name: 'Global Trade SARL',
        status: 'active',
        nif: '123456789',
        stat: 'STAT001',
        rcs: 'RCS001',
        region: 'Analamanga',
        address: 'Lot II A 45, Antananarivo',
        phone: '+261 34 12 345 67',
        email: 'contact@globaltrade.mg',
        label: 'Main distributor',
        active: true,
      },
      {
        name: 'Madagascar Export',
        status: 'inactive',
        nif: '987654321',
        stat: 'STAT002',
        rcs: 'RCS002',
        region: 'Atsinanana',
        address: 'Rue du Port, Toamasina',
        phone: '+261 32 98 765 43',
        email: 'info@madaexport.mg',
        label: 'Seafood supplier',
        active: false,
      },
      {
        name: 'Agro Supply Co',
        status: 'active',
        nif: '456789123',
        stat: 'STAT003',
        rcs: 'RCS003',
        region: 'Vakinankaratra',
        address: 'Zone Industrielle, Antsirabe',
        phone: '+261 33 45 678 90',
        email: 'sales@agrosupply.mg',
        label: 'Agriculture products',
        active: true,
      },
      {
        name: 'Techno Import',
        status: 'active',
        nif: '741852963',
        stat: 'STAT004',
        rcs: 'RCS004',
        region: 'Analamanga',
        address: 'Immeuble Galaxy, Antananarivo',
        phone: '+261 34 56 789 01',
        email: 'support@technoimport.mg',
        label: 'Electronics',
        active: true,
      },
      {
        name: 'Pharma Distribution',
        status: 'inactive',
        nif: '159753486',
        stat: 'STAT005',
        rcs: 'RCS005',
        region: 'Sava',
        address: 'Rue Principale, Sambava',
        phone: '+261 32 11 223 34',
        email: 'pharma@distribution.mg',
        label: 'Medical supplies',
        active: false,
      },
      {
        name: 'Vanilla Exporters',
        status: 'active',
        nif: '852369741',
        stat: 'STAT006',
        rcs: 'RCS006',
        region: 'Sava',
        address: 'Quartier Vanilla, Antalaha',
        phone: '+261 34 77 888 99',
        email: 'vanilla@exporters.mg',
        label: 'Vanilla products',
        active: true,
      },
      {
        name: 'Construction Materials Ltd',
        status: 'inactive',
        nif: '963852741',
        stat: 'STAT007',
        rcs: 'RCS007',
        region: 'Boeny',
        address: 'Zone Portuaire, Mahajanga',
        phone: '+261 32 44 556 77',
        email: 'contact@construction.mg',
        label: 'Building materials',
        active: false,
      },
      {
        name: 'Green Energy Solutions',
        status: 'active',
        nif: '321654987',
        stat: 'STAT008',
        rcs: 'RCS008',
        region: 'Diana',
        address: 'Rue Soleil, Antsiranana',
        phone: '+261 34 22 334 55',
        email: 'info@greenenergy.mg',
        label: 'Renewable energy',
        active: true,
      },
      {
        name: 'Textile Factory',
        status: 'active',
        nif: '654987321',
        stat: 'STAT009',
        rcs: 'RCS009',
        region: 'Haute Matsiatra',
        address: 'Zone Industrielle, Fianarantsoa',
        phone: '+261 33 99 112 23',
        email: 'textile@factory.mg',
        label: 'Clothing',
        active: true,
      },
      {
        name: 'Rice Traders',
        status: 'inactive',
        nif: '147258369',
        stat: 'STAT010',
        rcs: 'RCS010',
        region: 'Alaotra Mangoro',
        address: 'Marché Central, Ambatondrazaka',
        phone: '+261 32 55 667 88',
        email: 'rice@traders.mg',
        label: 'Rice distribution',
        active: false,
      },
    ];

    for (const supplierData of suppliersData) {
      let supplier = await prisma.supplier.findFirst({
        where: { nif: supplierData.nif },
      });

      if (!supplier) {
        supplier = await prisma.supplier.create({ data: supplierData });
        console.log(`✅ Created supplier: ${supplierData.name}`);
      } else {
        console.log(`ℹ️ Supplier already exists: ${supplierData.name}`);
      }
    }

    console.log('\n🎉 Suppliers test data seeded successfully!\n');
    console.log('🔗 Test endpoints:');
    console.log('   - GET http://localhost:3000/suppliers');
    console.log('   - GET http://localhost:3000/suppliers?status=active');
    console.log(
      '   - GET http://localhost:3000/suppliers?region=Sava&active=true\n',
    );
  } catch (error) {
    console.error('❌ Error seeding suppliers:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Exécuter le seeding
seedSuppliersData().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
