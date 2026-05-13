import foodData from '../data/foodData.json'

export default function FoodIntelligence() {
  return <div className='p-6'><h1 className='text-xl font-bold mb-2'>Food Intelligence</h1><p className='text-slate-600 mb-3'>Static food reference table.</p><p className='text-slate-700'>Foods in reference: {foodData.length}</p></div>
}
