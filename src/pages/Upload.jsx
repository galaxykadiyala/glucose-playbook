import CSVUpload from '../components/CSVUpload'

export default function Upload() {
  return (
    <div>
      <div className="page-header mb-8">
        <h1 className="page-title">Upload CGM Data</h1>
        <p className="page-subtitle">Import an Ultrahuman CSV export to add a new stint</p>
      </div>
      <CSVUpload />
    </div>
  )
}
