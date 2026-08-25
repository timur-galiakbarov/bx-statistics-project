<? // подключение служебной части пролога
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/prolog_before.php");
//------------------------------------------------------------------------------?>
<?php
require_once './PHPExcel/PHPExcel.php'; // Подключаем библиотеку PHPExcel
$phpexcel = new PHPExcel(); // Создаём объект PHPExcel

$dataPost = $_POST;

if ($dataPost["offset"] < $dataPost["count"]) {
    $_SESSION["reportFindAnalog"][$dataPost["iteration"]] = $dataPost["list"];
    print_r(json_encode(Array("success" => true, "executedCount" => $dataPost["offset"], "iteration" => $dataPost["iteration"])));
    return;
} else {
    $_SESSION["reportFindAnalog"][$dataPost["iteration"]] = $dataPost["list"];
}

/* Каждый раз делаем активной 1-ю страницу и получаем её, потом записываем в неё данные */
$page = $phpexcel->setActiveSheetIndex(0); // Делаем активной первую страницу и получаем её

$i = 1;
$page->setCellValue("A" . $i, "Название группы");
$page->setCellValue("B" . $i, "ID");
$page->setCellValue("C" . $i, "Количество подписчиков");
$page->setCellValue("D" . $i, "Количество пересечений");
$page->setCellValue("E" . $i, "Контакты");
$i = 2;
foreach ($_SESSION["reportFindAnalog"] as $arr) {
    $list = json_decode($arr);

    foreach ($list as $value) {
        $page->setCellValue("A" . $i, strval($value->name));
        $page->setCellValue("B" . $i, strval($value->gid));
        $page->setCellValue("C" . $i, strval($value->members_count));
        $page->setCellValue("D" . $i, strval($value->intersection));
        foreach ($value->contacts as $contact) {
            if ($contact->desc) {
                $page->setCellValue("E" . $i, strval($contact->desc));
                $i++;
            }
            if ($contact->phone) {
                $page->setCellValue("E" . $i, strval($contact->phone));
                $i++;
            }
            if ($contact->email) {
                $page->setCellValue("E" . $i, strval($contact->email));
                $i++;
            }
            if ($contact->user_id) {
                $page->setCellValue("E" . $i, strval("user_id: " . $contact->user_id));
                $i++;
            }
        }

        $i++;
    }
}
$page->getColumnDimension('A')->setWidth(30);
$page->getColumnDimension('B')->setWidth(15);
$page->getColumnDimension('C')->setWidth(25);
$page->getColumnDimension('D')->setWidth(25);
$page->getColumnDimension('E')->setWidth(25);
$page->setTitle("Где еще сидят подписчики"); // Ставим заголовок на странице

/* Начинаем готовиться к записи информации в xlsx-файл */
$objWriter = PHPExcel_IOFactory::createWriter($phpexcel, 'Excel2007');

/* Записываем в файл */
global $USER;
$objWriter->save("reports/" . "socstat_analog_" . $USER->GetID() . "_" . $dataPost["dateCreate"] . ".xlsx");

print_r(json_encode(Array("success" => true, "reportUrl" => "/controllers/common/reports/" . "socstat_analog_" . $USER->GetID() . "_" . $dataPost["dateCreate"] . ".xlsx")));
$_SESSION["reportFindAnalog"] = null;
?>
<? //----------------------------------------------------------------------------
require($_SERVER["DOCUMENT_ROOT"] . "/bitrix/modules/main/include/epilog_after.php"); ?>
