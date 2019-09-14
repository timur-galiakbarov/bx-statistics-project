<? // подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>
<?
$filepath = $_SERVER['DOCUMENT_ROOT']."/controllers/common/reports/".$_GET['filename'];
// немножко контроля за попытками взлома...
//$filepath = preg_replace('/:/', '', $filepath);
//$filepath = preg_replace('/^\/+/', '', $filepath);
//$filepath = preg_replace('/(\.+\/)/', '', $filepath);

$filename = preg_replace('/(.*\/)/', '', $filepath);

if($filepath=='' || $filename=='' || !file_exists($filepath))    die("No such file");

header("Content-Disposition: attachment; filename=$filename");
header("Content-Type: application/octet-stream");
// ещё можно накидать информацию о дате, о кешировании и т.п.

readfile($filepath);
?>

<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>
